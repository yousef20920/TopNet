# app/api/deploy.py
"""API endpoints for deploying topologies to cloud providers."""

import asyncio
import json
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import TopologyGraph, TerraformFile
from app.terraform.aws.generator import generate_aws_terraform, terraform_to_json

router = APIRouter(prefix="/api/deploy", tags=["deploy"])


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    INITIALIZING = "initializing"
    PLANNING = "planning"
    APPLYING = "applying"
    COMPLETED = "completed"
    FAILED = "failed"
    DESTROYED = "destroyed"


class DeploymentState(BaseModel):
    """Tracks the state of a deployment."""
    
    id: str
    status: DeploymentStatus
    topology_id: str
    provider: str = "aws"
    region: str = "us-east-1"
    created_at: str
    updated_at: str
    message: str | None = None
    outputs: dict | None = None
    error: str | None = None
    plan_output: str | None = None
    apply_output: str | None = None


# In-memory deployment store (in production, use a database)
deployments: dict[str, DeploymentState] = {}
deployment_workdirs: dict[str, str] = {}


class DeployRequest(BaseModel):
    topology: TopologyGraph
    auto_approve: bool = Field(default=False, description="Skip plan confirmation")


class DeployResponse(BaseModel):
    deployment_id: str
    status: DeploymentStatus
    message: str


class PlanRequest(BaseModel):
    topology: TopologyGraph


class PlanResponse(BaseModel):
    deployment_id: str
    terraform_files: list[TerraformFile]
    plan_output: str | None = None
    status: DeploymentStatus


class DestroyRequest(BaseModel):
    deployment_id: str


class DestroyResponse(BaseModel):
    deployment_id: str
    status: DeploymentStatus
    message: str


def _check_terraform_installed() -> bool:
    """Check if Terraform is installed."""
    return shutil.which("terraform") is not None


def _check_aws_credentials() -> bool:
    """Check if AWS credentials are configured."""
    # Check environment variables
    if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        return True
    
    # Check AWS credentials file
    aws_creds = Path.home() / ".aws" / "credentials"
    if aws_creds.exists():
        return True
    
    return False


async def _run_terraform_command(workdir: str, command: list[str]) -> tuple[int, str, str]:
    """Run a Terraform command asynchronously."""
    process = await asyncio.create_subprocess_exec(
        "terraform",
        *command,
        cwd=workdir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    return process.returncode or 0, stdout.decode(), stderr.decode()


@router.get("/check")
async def check_deployment_prerequisites() -> dict:
    """Check if deployment prerequisites are met."""
    terraform_ok = _check_terraform_installed()
    aws_ok = _check_aws_credentials()
    
    return {
        "ready": terraform_ok and aws_ok,
        "terraform_installed": terraform_ok,
        "aws_credentials_configured": aws_ok,
        "message": (
            "Ready to deploy!" if (terraform_ok and aws_ok)
            else f"Missing: {'Terraform CLI' if not terraform_ok else ''}"
                 f"{' and ' if not terraform_ok and not aws_ok else ''}"
                 f"{'AWS credentials' if not aws_ok else ''}"
        )
    }


@router.post("/plan", response_model=PlanResponse)
async def plan_deployment(request: PlanRequest) -> PlanResponse:
    """Generate Terraform plan without applying."""
    
    # Check prerequisites
    if not _check_terraform_installed():
        raise HTTPException(status_code=400, detail="Terraform CLI is not installed")
    
    if not _check_aws_credentials():
        raise HTTPException(status_code=400, detail="AWS credentials not configured")
    
    # Generate Terraform config
    tf_config = generate_aws_terraform(request.topology)
    tf_json = terraform_to_json(tf_config)
    
    # Create deployment record
    deployment_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    
    deployment = DeploymentState(
        id=deployment_id,
        status=DeploymentStatus.PLANNING,
        topology_id=request.topology.id,
        created_at=now,
        updated_at=now,
        message="Planning deployment..."
    )
    deployments[deployment_id] = deployment
    
    # Create temp directory and write Terraform files
    workdir = tempfile.mkdtemp(prefix=f"topnet_{deployment_id}_")
    deployment_workdirs[deployment_id] = workdir
    
    tf_file = Path(workdir) / "main.tf.json"
    tf_file.write_text(tf_json)
    
    # Run terraform init
    returncode, stdout, stderr = await _run_terraform_command(workdir, ["init", "-no-color"])
    if returncode != 0:
        deployment.status = DeploymentStatus.FAILED
        deployment.error = stderr or stdout
        deployment.updated_at = datetime.now(timezone.utc).isoformat()
        return PlanResponse(
            deployment_id=deployment_id,
            terraform_files=[TerraformFile(filename="main.tf.json", content=tf_json)],
            plan_output=f"Init failed:\n{stderr or stdout}",
            status=DeploymentStatus.FAILED
        )
    
    # Run terraform plan
    returncode, stdout, stderr = await _run_terraform_command(workdir, ["plan", "-no-color"])
    
    plan_output = stdout if returncode == 0 else f"Plan failed:\n{stderr or stdout}"
    
    deployment.status = DeploymentStatus.PENDING if returncode == 0 else DeploymentStatus.FAILED
    deployment.plan_output = plan_output
    deployment.updated_at = datetime.now(timezone.utc).isoformat()
    deployment.message = "Plan complete. Ready to apply." if returncode == 0 else "Plan failed"
    
    return PlanResponse(
        deployment_id=deployment_id,
        terraform_files=[TerraformFile(filename="main.tf.json", content=tf_json)],
        plan_output=plan_output,
        status=deployment.status
    )


@router.post("/apply/{deployment_id}", response_model=DeployResponse)
async def apply_deployment(deployment_id: str) -> DeployResponse:
    """Apply a planned deployment."""
    
    if deployment_id not in deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    deployment = deployments[deployment_id]
    workdir = deployment_workdirs.get(deployment_id)
    
    if not workdir or not Path(workdir).exists():
        raise HTTPException(status_code=400, detail="Deployment workspace not found")
    
    if deployment.status not in [DeploymentStatus.PENDING, DeploymentStatus.FAILED]:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot apply deployment in {deployment.status} state"
        )
    
    deployment.status = DeploymentStatus.APPLYING
    deployment.message = "Applying infrastructure..."
    deployment.updated_at = datetime.now(timezone.utc).isoformat()
    
    # Run terraform apply
    returncode, stdout, stderr = await _run_terraform_command(
        workdir, ["apply", "-auto-approve", "-no-color"]
    )
    
    if returncode == 0:
        deployment.status = DeploymentStatus.COMPLETED
        deployment.apply_output = stdout
        deployment.message = "Deployment completed successfully!"
        
        # Get outputs
        ret, out, _ = await _run_terraform_command(workdir, ["output", "-json"])
        if ret == 0:
            try:
                deployment.outputs = json.loads(out)
            except json.JSONDecodeError:
                pass
    else:
        deployment.status = DeploymentStatus.FAILED
        deployment.error = stderr or stdout
        deployment.apply_output = stderr or stdout
        deployment.message = "Deployment failed"
    
    deployment.updated_at = datetime.now(timezone.utc).isoformat()
    
    return DeployResponse(
        deployment_id=deployment_id,
        status=deployment.status,
        message=deployment.message or ""
    )


@router.post("/destroy", response_model=DestroyResponse)
async def destroy_deployment(request: DestroyRequest) -> DestroyResponse:
    """Destroy deployed infrastructure."""
    
    deployment_id = request.deployment_id
    
    if deployment_id not in deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    deployment = deployments[deployment_id]
    workdir = deployment_workdirs.get(deployment_id)
    
    if not workdir or not Path(workdir).exists():
        raise HTTPException(status_code=400, detail="Deployment workspace not found")
    
    deployment.message = "Destroying infrastructure..."
    deployment.updated_at = datetime.now(timezone.utc).isoformat()
    
    # Run terraform destroy
    returncode, stdout, stderr = await _run_terraform_command(
        workdir, ["destroy", "-auto-approve", "-no-color"]
    )
    
    if returncode == 0:
        deployment.status = DeploymentStatus.DESTROYED
        deployment.message = "Infrastructure destroyed successfully"
    else:
        deployment.status = DeploymentStatus.FAILED
        deployment.error = stderr or stdout
        deployment.message = "Failed to destroy infrastructure"
    
    deployment.updated_at = datetime.now(timezone.utc).isoformat()
    
    return DestroyResponse(
        deployment_id=deployment_id,
        status=deployment.status,
        message=deployment.message or ""
    )


@router.get("/status/{deployment_id}")
async def get_deployment_status(deployment_id: str) -> DeploymentState:
    """Get the status of a deployment."""
    
    if deployment_id not in deployments:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    return deployments[deployment_id]


@router.get("/list")
async def list_deployments() -> list[DeploymentState]:
    """List all deployments."""
    return list(deployments.values())
