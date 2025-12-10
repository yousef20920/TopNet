# app/api/topologies.py
"""API endpoints for topology operations."""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core import (
    BaseNode,
    Edge,
    EdgeKind,
    NodeKind,
    Provider,
    Severity,
    TerraformFile,
    TopologyGraph,
    ValidationResult,
)

router = APIRouter(prefix="/api/topologies", tags=["topologies"])


def get_hardcoded_topology() -> TopologyGraph:
    """Return a simple sample AWS topology - VPC, subnet, security group, EC2."""
    nodes = [
        # VPC
        BaseNode(
            id="vpc-1",
            kind=NodeKind.NETWORK,
            name="main-vpc",
            provider=Provider.AWS,
            region="us-east-1",
            props={
                "cidr_block": "10.0.0.0/16",
                "enable_dns_hostnames": True,
                "enable_dns_support": True,
            },
            tags={"Name": "topnet-vpc"},
        ),
        # Internet Gateway
        BaseNode(
            id="igw-1",
            kind=NodeKind.GATEWAY,
            name="main-igw",
            provider=Provider.AWS,
            region="us-east-1",
            props={"gateway_type": "internet"},
            tags={"Name": "topnet-igw"},
        ),
        # Public Subnet
        BaseNode(
            id="subnet-public-1",
            kind=NodeKind.SUBNET,
            name="public-subnet",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={
                "cidr_block": "10.0.1.0/24",
                "is_public": True,
                "map_public_ip_on_launch": True,
            },
            tags={"Name": "topnet-public-subnet"},
        ),
        # Route Table
        BaseNode(
            id="rt-public",
            kind=NodeKind.ROUTE_TABLE,
            name="public-rt",
            provider=Provider.AWS,
            region="us-east-1",
            props={"routes": [{"destination": "0.0.0.0/0", "target": "igw-1"}]},
            tags={"Name": "topnet-public-rt"},
        ),
        # Security Group
        BaseNode(
            id="sg-web",
            kind=NodeKind.SECURITY_GROUP,
            name="web-sg",
            provider=Provider.AWS,
            region="us-east-1",
            props={
                "description": "Allow SSH and HTTP",
                "ingress": [
                    {"from_port": 22, "to_port": 22, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                    {"from_port": 80, "to_port": 80, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                ],
                "egress": [
                    {"from_port": 0, "to_port": 0, "protocol": "-1", "cidr_blocks": ["0.0.0.0/0"]}
                ],
            },
            tags={"Name": "topnet-web-sg"},
        ),
        # EC2 Instance
        BaseNode(
            id="ec2-web-1",
            kind=NodeKind.COMPUTE_INSTANCE,
            name="web-server",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={
                "instance_type": "t2.micro",
                "subnet_id": "subnet-public-1",
                "security_groups": ["sg-web"],
            },
            tags={"Name": "topnet-web-server"},
        ),
    ]

    edges = [
        # IGW attached to VPC
        Edge(id="e1", kind=EdgeKind.ATTACHED_TO, from_node="igw-1", to_node="vpc-1"),
        # Subnet attached to VPC
        Edge(id="e2", kind=EdgeKind.ATTACHED_TO, from_node="subnet-public-1", to_node="vpc-1"),
        # Security group attached to VPC
        Edge(id="e3", kind=EdgeKind.ATTACHED_TO, from_node="sg-web", to_node="vpc-1"),
        # Route table attached to VPC
        Edge(id="e4", kind=EdgeKind.ATTACHED_TO, from_node="rt-public", to_node="vpc-1"),
        # Route table routes to IGW
        Edge(id="e5", kind=EdgeKind.ROUTES_TO, from_node="rt-public", to_node="igw-1"),
        # EC2 in subnet
        Edge(id="e6", kind=EdgeKind.ATTACHED_TO, from_node="ec2-web-1", to_node="subnet-public-1"),
    ]

    return TopologyGraph(
        id="topo-simple",
        name="Simple Web Server",
        nodes=nodes,
        edges=edges,
        metadata={
            "created_at": datetime.now(timezone.utc).isoformat(),
            "version": "0.1.0",
        },
    )


# Request/Response models
from pydantic import BaseModel


class GenerateRequest(BaseModel):
    prompt: str


class GenerateResponse(BaseModel):
    topology: TopologyGraph
    validation: list[ValidationResult]


class ValidateRequest(BaseModel):
    topology: TopologyGraph


class ValidateResponse(BaseModel):
    validation: list[ValidationResult]


class TerraformRequest(BaseModel):
    topology: TopologyGraph


class TerraformResponse(BaseModel):
    files: list[TerraformFile]


@router.post("/generate", response_model=GenerateResponse)
async def generate_topology(request: GenerateRequest) -> GenerateResponse:
    """Generate a topology from a natural language prompt."""
    print(f"[topologies/generate] Received prompt: '{request.prompt or '(no prompt)'}'")

    # For Phase 1, return hardcoded topology regardless of prompt
    topology = get_hardcoded_topology()

    validation = [
        ValidationResult(
            id="val-1",
            severity=Severity.INFO,
            message="Topology generated successfully (hardcoded for Phase 1)",
        )
    ]

    return GenerateResponse(topology=topology, validation=validation)


@router.post("/validate", response_model=ValidateResponse)
async def validate_topology(request: ValidateRequest) -> ValidateResponse:
    """Validate a topology graph."""
    validation: list[ValidationResult] = []

    if not request.topology.nodes:
        validation.append(
            ValidationResult(
                id="val-err-1",
                severity=Severity.ERROR,
                message="Topology must have at least one node",
            )
        )

    if not validation:
        validation.append(
            ValidationResult(
                id="val-ok",
                severity=Severity.INFO,
                message="Topology passed basic validation",
            )
        )

    return ValidateResponse(validation=validation)


@router.post("/terraform", response_model=TerraformResponse)
async def generate_terraform(request: TerraformRequest) -> TerraformResponse:
    """Generate Terraform files from a topology graph."""
    from app.terraform.aws.generator import generate_aws_terraform, terraform_to_json

    # Generate real Terraform configuration
    tf_config = generate_aws_terraform(request.topology)
    content = terraform_to_json(tf_config)

    return TerraformResponse(files=[TerraformFile(filename="main.tf.json", content=content)])
