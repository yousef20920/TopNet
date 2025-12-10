# app/api/aws_info.py
"""API endpoints for AWS account information."""

import os
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/aws", tags=["aws"])


class AWSAccountInfo(BaseModel):
    """AWS account information."""
    account_id: str | None = None
    account_alias: str | None = None
    user_name: str | None = None
    user_arn: str | None = None
    region: str = "us-east-1"


class AWSCredits(BaseModel):
    """AWS credits/billing information."""
    # Note: Real billing requires Cost Explorer API access
    estimated_monthly_cost: float | None = None
    credits_remaining: float | None = None
    free_tier_usage: dict[str, Any] | None = None


class EC2Summary(BaseModel):
    """EC2 instances summary."""
    total: int = 0
    running: int = 0
    stopped: int = 0
    instances: list[dict[str, Any]] = []


class VPCSummary(BaseModel):
    """VPC summary."""
    total: int = 0
    vpcs: list[dict[str, Any]] = []


class AWSResourceSummary(BaseModel):
    """Summary of AWS resources."""
    ec2: EC2Summary = EC2Summary()
    vpcs: VPCSummary = VPCSummary()
    security_groups: int = 0
    subnets: int = 0
    load_balancers: int = 0
    rds_instances: int = 0


class AWSDashboard(BaseModel):
    """Complete AWS dashboard data."""
    connected: bool = False
    account: AWSAccountInfo | None = None
    resources: AWSResourceSummary = AWSResourceSummary()
    credits: AWSCredits = AWSCredits()
    error: str | None = None


def _get_boto3_client(service: str, region: str = "us-east-1"):
    """Get a boto3 client for the specified service."""
    try:
        import boto3
        return boto3.client(
            service,
            region_name=region,
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create AWS client: {str(e)}")


@router.get("/dashboard", response_model=AWSDashboard)
async def get_aws_dashboard(region: str = "us-east-1") -> AWSDashboard:
    """Get comprehensive AWS account dashboard."""
    dashboard = AWSDashboard()
    
    # Check if credentials are configured
    if not os.environ.get("AWS_ACCESS_KEY_ID") or not os.environ.get("AWS_SECRET_ACCESS_KEY"):
        dashboard.error = "AWS credentials not configured"
        return dashboard
    
    try:
        import boto3
    except ImportError:
        dashboard.error = "boto3 not installed. Run: pip install boto3"
        return dashboard
    
    try:
        # Get account info via STS
        sts = _get_boto3_client("sts", region)
        identity = sts.get_caller_identity()
        
        dashboard.connected = True
        dashboard.account = AWSAccountInfo(
            account_id=identity.get("Account"),
            user_arn=identity.get("Arn"),
            user_name=identity.get("Arn", "").split("/")[-1] if "/" in identity.get("Arn", "") else None,
            region=region,
        )
        
        # Try to get account alias
        try:
            iam = _get_boto3_client("iam", region)
            aliases = iam.list_account_aliases().get("AccountAliases", [])
            if aliases:
                dashboard.account.account_alias = aliases[0]
        except Exception:
            pass  # Alias is optional
        
        # Get EC2 instances
        try:
            ec2 = _get_boto3_client("ec2", region)
            instances_response = ec2.describe_instances()
            
            instances = []
            running = 0
            stopped = 0
            
            for reservation in instances_response.get("Reservations", []):
                for instance in reservation.get("Instances", []):
                    state = instance.get("State", {}).get("Name", "unknown")
                    name = ""
                    for tag in instance.get("Tags", []):
                        if tag.get("Key") == "Name":
                            name = tag.get("Value", "")
                            break
                    
                    instances.append({
                        "id": instance.get("InstanceId"),
                        "name": name,
                        "type": instance.get("InstanceType"),
                        "state": state,
                        "az": instance.get("Placement", {}).get("AvailabilityZone"),
                    })
                    
                    if state == "running":
                        running += 1
                    elif state == "stopped":
                        stopped += 1
            
            dashboard.resources.ec2 = EC2Summary(
                total=len(instances),
                running=running,
                stopped=stopped,
                instances=instances[:10],  # Limit to first 10
            )
        except Exception as e:
            print(f"Error fetching EC2: {e}")
        
        # Get VPCs
        try:
            ec2 = _get_boto3_client("ec2", region)
            vpcs_response = ec2.describe_vpcs()
            
            vpcs = []
            for vpc in vpcs_response.get("Vpcs", []):
                name = ""
                for tag in vpc.get("Tags", []):
                    if tag.get("Key") == "Name":
                        name = tag.get("Value", "")
                        break
                
                vpcs.append({
                    "id": vpc.get("VpcId"),
                    "name": name,
                    "cidr": vpc.get("CidrBlock"),
                    "is_default": vpc.get("IsDefault", False),
                    "state": vpc.get("State"),
                })
            
            dashboard.resources.vpcs = VPCSummary(
                total=len(vpcs),
                vpcs=vpcs,
            )
        except Exception as e:
            print(f"Error fetching VPCs: {e}")
        
        # Get Security Groups count
        try:
            ec2 = _get_boto3_client("ec2", region)
            sgs = ec2.describe_security_groups()
            dashboard.resources.security_groups = len(sgs.get("SecurityGroups", []))
        except Exception:
            pass
        
        # Get Subnets count
        try:
            ec2 = _get_boto3_client("ec2", region)
            subnets = ec2.describe_subnets()
            dashboard.resources.subnets = len(subnets.get("Subnets", []))
        except Exception:
            pass
        
        # Get Load Balancers count
        try:
            elbv2 = _get_boto3_client("elbv2", region)
            lbs = elbv2.describe_load_balancers()
            dashboard.resources.load_balancers = len(lbs.get("LoadBalancers", []))
        except Exception:
            pass
        
        # Get RDS instances count
        try:
            rds = _get_boto3_client("rds", region)
            dbs = rds.describe_db_instances()
            dashboard.resources.rds_instances = len(dbs.get("DBInstances", []))
        except Exception:
            pass
        
    except Exception as e:
        dashboard.connected = False
        dashboard.error = str(e)
    
    return dashboard


@router.get("/regions")
async def get_aws_regions() -> list[dict[str, str]]:
    """Get list of AWS regions."""
    # Common regions - in production, fetch dynamically
    return [
        {"code": "us-east-1", "name": "US East (N. Virginia)"},
        {"code": "us-east-2", "name": "US East (Ohio)"},
        {"code": "us-west-1", "name": "US West (N. California)"},
        {"code": "us-west-2", "name": "US West (Oregon)"},
        {"code": "eu-west-1", "name": "Europe (Ireland)"},
        {"code": "eu-west-2", "name": "Europe (London)"},
        {"code": "eu-central-1", "name": "Europe (Frankfurt)"},
        {"code": "ap-northeast-1", "name": "Asia Pacific (Tokyo)"},
        {"code": "ap-southeast-1", "name": "Asia Pacific (Singapore)"},
        {"code": "ap-southeast-2", "name": "Asia Pacific (Sydney)"},
    ]
