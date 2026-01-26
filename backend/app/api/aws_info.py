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
            region=region,
        )

        # Try to get the actual IAM username
        user_name = None
        try:
            iam = _get_boto3_client("iam", region)

            # First try to get current user (works for IAM users)
            try:
                current_user = iam.get_user()
                user_name = current_user.get("User", {}).get("UserName")
            except Exception:
                # If get_user fails, extract from ARN (works for roles)
                arn = identity.get("Arn", "")
                if "/" in arn:
                    user_name = arn.split("/")[-1]

            # Try to get account alias
            try:
                aliases = iam.list_account_aliases().get("AccountAliases", [])
                if aliases:
                    dashboard.account.account_alias = aliases[0]
            except Exception:
                pass  # Alias is optional
        except Exception as e:
            print(f"Error getting IAM info: {e}")
            # Fall back to ARN extraction
            arn = identity.get("Arn", "")
            if "/" in arn:
                user_name = arn.split("/")[-1]

        dashboard.account.user_name = user_name
        
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
            
            # Filter out terminated instances for display
            active_instances = [i for i in instances if i["state"] != "terminated"]
            
            dashboard.resources.ec2 = EC2Summary(
                total=len(active_instances),
                running=running,
                stopped=stopped,
                instances=active_instances[:10],  # Limit to first 10
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


class CleanupResponse(BaseModel):
    """Cleanup operation response."""
    success: bool
    deleted: dict[str, list[str]]
    errors: list[str]


@router.post("/cleanup", response_model=CleanupResponse)
async def cleanup_topnet_resources(region: str = "us-east-2") -> CleanupResponse:
    """Delete all TopNet-managed resources (VPCs, subnets, security groups, etc.)."""
    deleted: dict[str, list[str]] = {
        "instances": [],
        "security_groups": [],
        "subnets": [],
        "route_tables": [],
        "internet_gateways": [],
        "nat_gateways": [],
        "vpcs": [],
    }
    errors: list[str] = []
    
    try:
        ec2 = _get_boto3_client("ec2", region)
        
        # Find TopNet-managed VPCs (tagged with ManagedBy: TopNet)
        vpcs_response = ec2.describe_vpcs(
            Filters=[{"Name": "tag:ManagedBy", "Values": ["TopNet"]}]
        )
        
        for vpc in vpcs_response.get("Vpcs", []):
            vpc_id = vpc["VpcId"]
            vpc_name = ""
            for tag in vpc.get("Tags", []):
                if tag["Key"] == "Name":
                    vpc_name = tag["Value"]
            
            try:
                # 1. Terminate EC2 instances in this VPC
                instances = ec2.describe_instances(
                    Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                )
                instance_ids = []
                for res in instances.get("Reservations", []):
                    for inst in res.get("Instances", []):
                        if inst["State"]["Name"] != "terminated":
                            instance_ids.append(inst["InstanceId"])
                
                if instance_ids:
                    ec2.terminate_instances(InstanceIds=instance_ids)
                    # Wait for termination
                    waiter = ec2.get_waiter("instance_terminated")
                    waiter.wait(InstanceIds=instance_ids)
                    deleted["instances"].extend(instance_ids)
                
                # 2. Delete NAT Gateways
                nat_gws = ec2.describe_nat_gateways(
                    Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                )
                for nat in nat_gws.get("NatGateways", []):
                    if nat["State"] not in ["deleted", "deleting"]:
                        ec2.delete_nat_gateway(NatGatewayId=nat["NatGatewayId"])
                        deleted["nat_gateways"].append(nat["NatGatewayId"])
                
                # 3. Delete Internet Gateways
                igws = ec2.describe_internet_gateways(
                    Filters=[{"Name": "attachment.vpc-id", "Values": [vpc_id]}]
                )
                for igw in igws.get("InternetGateways", []):
                    ec2.detach_internet_gateway(InternetGatewayId=igw["InternetGatewayId"], VpcId=vpc_id)
                    ec2.delete_internet_gateway(InternetGatewayId=igw["InternetGatewayId"])
                    deleted["internet_gateways"].append(igw["InternetGatewayId"])
                
                # 4. Delete Subnets
                subnets = ec2.describe_subnets(
                    Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                )
                for subnet in subnets.get("Subnets", []):
                    ec2.delete_subnet(SubnetId=subnet["SubnetId"])
                    deleted["subnets"].append(subnet["SubnetId"])
                
                # 5. Delete Route Tables (skip main)
                rts = ec2.describe_route_tables(
                    Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                )
                for rt in rts.get("RouteTables", []):
                    is_main = any(assoc.get("Main", False) for assoc in rt.get("Associations", []))
                    if not is_main:
                        # Delete associations first
                        for assoc in rt.get("Associations", []):
                            if not assoc.get("Main", False):
                                try:
                                    ec2.disassociate_route_table(AssociationId=assoc["RouteTableAssociationId"])
                                except Exception:
                                    pass
                        ec2.delete_route_table(RouteTableId=rt["RouteTableId"])
                        deleted["route_tables"].append(rt["RouteTableId"])
                
                # 6. Delete Security Groups (skip default)
                sgs = ec2.describe_security_groups(
                    Filters=[{"Name": "vpc-id", "Values": [vpc_id]}]
                )
                for sg in sgs.get("SecurityGroups", []):
                    if sg["GroupName"] != "default":
                        ec2.delete_security_group(GroupId=sg["GroupId"])
                        deleted["security_groups"].append(sg["GroupId"])
                
                # 7. Delete VPC
                ec2.delete_vpc(VpcId=vpc_id)
                deleted["vpcs"].append(f"{vpc_id} ({vpc_name})")
                
            except Exception as e:
                errors.append(f"Error cleaning VPC {vpc_id}: {str(e)}")
        
        return CleanupResponse(
            success=len(errors) == 0,
            deleted=deleted,
            errors=errors
        )
        
    except Exception as e:
        return CleanupResponse(
            success=False,
            deleted=deleted,
            errors=[str(e)]
        )
