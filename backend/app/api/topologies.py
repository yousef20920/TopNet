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
    """Return a hardcoded sample AWS topology for Phase 1."""
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
            tags={"Name": "main-vpc", "Environment": "dev"},
        ),
        # Internet Gateway
        BaseNode(
            id="igw-1",
            kind=NodeKind.GATEWAY,
            name="main-igw",
            provider=Provider.AWS,
            region="us-east-1",
            props={"gateway_type": "internet"},
            tags={"Name": "main-igw"},
        ),
        # Public Subnet AZ-a
        BaseNode(
            id="subnet-public-1",
            kind=NodeKind.SUBNET,
            name="public-subnet-1",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={
                "cidr_block": "10.0.1.0/24",
                "is_public": True,
                "map_public_ip_on_launch": True,
            },
            tags={"Name": "public-subnet-1", "Tier": "public"},
        ),
        # Public Subnet AZ-b
        BaseNode(
            id="subnet-public-2",
            kind=NodeKind.SUBNET,
            name="public-subnet-2",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1b",
            props={
                "cidr_block": "10.0.2.0/24",
                "is_public": True,
                "map_public_ip_on_launch": True,
            },
            tags={"Name": "public-subnet-2", "Tier": "public"},
        ),
        # Private Subnet AZ-a (Web Tier)
        BaseNode(
            id="subnet-private-1",
            kind=NodeKind.SUBNET,
            name="private-subnet-1",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={"cidr_block": "10.0.10.0/24", "is_public": False},
            tags={"Name": "private-subnet-1", "Tier": "private"},
        ),
        # Private Subnet AZ-b (Web Tier)
        BaseNode(
            id="subnet-private-2",
            kind=NodeKind.SUBNET,
            name="private-subnet-2",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1b",
            props={"cidr_block": "10.0.11.0/24", "is_public": False},
            tags={"Name": "private-subnet-2", "Tier": "private"},
        ),
        # Database Subnet AZ-a
        BaseNode(
            id="subnet-db-1",
            kind=NodeKind.SUBNET,
            name="db-subnet-1",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={"cidr_block": "10.0.20.0/24", "is_public": False},
            tags={"Name": "db-subnet-1", "Tier": "database"},
        ),
        # NAT Gateway
        BaseNode(
            id="nat-1",
            kind=NodeKind.GATEWAY,
            name="nat-gateway-1",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={"gateway_type": "nat", "subnet_id": "subnet-public-1"},
            tags={"Name": "nat-gateway-1"},
        ),
        # Security Group - ALB
        BaseNode(
            id="sg-alb",
            kind=NodeKind.SECURITY_GROUP,
            name="alb-sg",
            provider=Provider.AWS,
            region="us-east-1",
            props={
                "description": "Security group for ALB",
                "ingress": [
                    {"from_port": 80, "to_port": 80, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                    {"from_port": 443, "to_port": 443, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                ],
                "egress": [
                    {"from_port": 0, "to_port": 0, "protocol": "-1", "cidr_blocks": ["0.0.0.0/0"]}
                ],
            },
            tags={"Name": "alb-sg"},
        ),
        # Security Group - Web Tier
        BaseNode(
            id="sg-web",
            kind=NodeKind.SECURITY_GROUP,
            name="web-sg",
            provider=Provider.AWS,
            region="us-east-1",
            props={
                "description": "Security group for web tier",
                "ingress": [
                    {"from_port": 80, "to_port": 80, "protocol": "tcp", "source_security_group": "sg-alb"},
                    {"from_port": 443, "to_port": 443, "protocol": "tcp", "source_security_group": "sg-alb"},
                ],
                "egress": [
                    {"from_port": 0, "to_port": 0, "protocol": "-1", "cidr_blocks": ["0.0.0.0/0"]}
                ],
            },
            tags={"Name": "web-sg"},
        ),
        # Security Group - Database
        BaseNode(
            id="sg-db",
            kind=NodeKind.SECURITY_GROUP,
            name="db-sg",
            provider=Provider.AWS,
            region="us-east-1",
            props={
                "description": "Security group for database",
                "ingress": [
                    {"from_port": 5432, "to_port": 5432, "protocol": "tcp", "source_security_group": "sg-web"}
                ],
                "egress": [],
            },
            tags={"Name": "db-sg"},
        ),
        # Application Load Balancer
        BaseNode(
            id="alb-1",
            kind=NodeKind.LOAD_BALANCER,
            name="web-alb",
            provider=Provider.AWS,
            region="us-east-1",
            props={
                "lb_type": "application",
                "scheme": "internet-facing",
                "subnets": ["subnet-public-1", "subnet-public-2"],
                "security_groups": ["sg-alb"],
            },
            tags={"Name": "web-alb"},
        ),
        # EC2 Instance - Web Server 1
        BaseNode(
            id="ec2-web-1",
            kind=NodeKind.COMPUTE_INSTANCE,
            name="web-server-1",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={
                "instance_type": "t3.micro",
                "ami": "ami-placeholder",
                "subnet_id": "subnet-private-1",
                "security_groups": ["sg-web"],
            },
            tags={"Name": "web-server-1", "Role": "web"},
        ),
        # EC2 Instance - Web Server 2
        BaseNode(
            id="ec2-web-2",
            kind=NodeKind.COMPUTE_INSTANCE,
            name="web-server-2",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1b",
            props={
                "instance_type": "t3.micro",
                "ami": "ami-placeholder",
                "subnet_id": "subnet-private-2",
                "security_groups": ["sg-web"],
            },
            tags={"Name": "web-server-2", "Role": "web"},
        ),
        # RDS Database
        BaseNode(
            id="rds-1",
            kind=NodeKind.DATABASE,
            name="main-db",
            provider=Provider.AWS,
            region="us-east-1",
            az="us-east-1a",
            props={
                "engine": "postgres",
                "engine_version": "15.4",
                "instance_class": "db.t3.micro",
                "allocated_storage": 20,
                "subnet_id": "subnet-db-1",
                "security_groups": ["sg-db"],
                "multi_az": False,
            },
            tags={"Name": "main-db"},
        ),
        # Route Table - Public
        BaseNode(
            id="rt-public",
            kind=NodeKind.ROUTE_TABLE,
            name="public-rt",
            provider=Provider.AWS,
            region="us-east-1",
            props={"routes": [{"destination": "0.0.0.0/0", "target": "igw-1"}]},
            tags={"Name": "public-rt"},
        ),
        # Route Table - Private
        BaseNode(
            id="rt-private",
            kind=NodeKind.ROUTE_TABLE,
            name="private-rt",
            provider=Provider.AWS,
            region="us-east-1",
            props={"routes": [{"destination": "0.0.0.0/0", "target": "nat-1"}]},
            tags={"Name": "private-rt"},
        ),
    ]

    edges = [
        # IGW attached to VPC
        Edge(id="e1", kind=EdgeKind.ATTACHED_TO, from_node="igw-1", to_node="vpc-1"),
        # Subnets attached to VPC
        Edge(id="e2", kind=EdgeKind.ATTACHED_TO, from_node="subnet-public-1", to_node="vpc-1"),
        Edge(id="e3", kind=EdgeKind.ATTACHED_TO, from_node="subnet-public-2", to_node="vpc-1"),
        Edge(id="e4", kind=EdgeKind.ATTACHED_TO, from_node="subnet-private-1", to_node="vpc-1"),
        Edge(id="e5", kind=EdgeKind.ATTACHED_TO, from_node="subnet-private-2", to_node="vpc-1"),
        Edge(id="e6", kind=EdgeKind.ATTACHED_TO, from_node="subnet-db-1", to_node="vpc-1"),
        # NAT Gateway in public subnet
        Edge(id="e7", kind=EdgeKind.ATTACHED_TO, from_node="nat-1", to_node="subnet-public-1"),
        # Security groups attached to VPC
        Edge(id="e8", kind=EdgeKind.ATTACHED_TO, from_node="sg-alb", to_node="vpc-1"),
        Edge(id="e9", kind=EdgeKind.ATTACHED_TO, from_node="sg-web", to_node="vpc-1"),
        Edge(id="e10", kind=EdgeKind.ATTACHED_TO, from_node="sg-db", to_node="vpc-1"),
        # ALB in public subnets
        Edge(id="e11", kind=EdgeKind.ATTACHED_TO, from_node="alb-1", to_node="subnet-public-1"),
        Edge(id="e12", kind=EdgeKind.ATTACHED_TO, from_node="alb-1", to_node="subnet-public-2"),
        # EC2 instances in private subnets
        Edge(id="e13", kind=EdgeKind.ATTACHED_TO, from_node="ec2-web-1", to_node="subnet-private-1"),
        Edge(id="e14", kind=EdgeKind.ATTACHED_TO, from_node="ec2-web-2", to_node="subnet-private-2"),
        # RDS in db subnet
        Edge(id="e15", kind=EdgeKind.ATTACHED_TO, from_node="rds-1", to_node="subnet-db-1"),
        # Route tables attached to VPC
        Edge(id="e16", kind=EdgeKind.ATTACHED_TO, from_node="rt-public", to_node="vpc-1"),
        Edge(id="e17", kind=EdgeKind.ATTACHED_TO, from_node="rt-private", to_node="vpc-1"),
        # Public route table routes to IGW
        Edge(id="e18", kind=EdgeKind.ROUTES_TO, from_node="rt-public", to_node="igw-1"),
        # Private route table routes to NAT
        Edge(id="e19", kind=EdgeKind.ROUTES_TO, from_node="rt-private", to_node="nat-1"),
        # Traffic flow: ALB -> Web
        Edge(id="e20", kind=EdgeKind.ALLOWED_TRAFFIC, from_node="sg-alb", to_node="sg-web", props={"ports": [80, 443]}),
        # Traffic flow: Web -> DB
        Edge(id="e21", kind=EdgeKind.ALLOWED_TRAFFIC, from_node="sg-web", to_node="sg-db", props={"ports": [5432]}),
    ]

    return TopologyGraph(
        id="topo-001",
        name="Sample AWS Topology",
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
