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
                "instance_type": "t3.micro",
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
    from app.core.nlp import parse_nl_to_spec
    from app.core.builder import build_topology_from_spec

    print(f"[topologies/generate] Received prompt: '{request.prompt or '(no prompt)'}'")

    # If no prompt provided, return a simple default topology
    if not request.prompt or not request.prompt.strip():
        topology = get_hardcoded_topology()
        return GenerateResponse(
            topology=topology,
            validation=[
                ValidationResult(
                    id="val-1",
                    severity=Severity.INFO,
                    message="Using default topology (no prompt provided)",
                ),
                ValidationResult(
                    id="val-hint",
                    severity=Severity.INFO,
                    message="💡 Try: 'Create 2 web servers with a PostgreSQL database'",
                ),
            ],
        )

    # Phase 2: Parse NL -> Spec -> Graph
    try:
        # Step 1: Parse natural language to TopologySpec
        spec = parse_nl_to_spec(request.prompt)
        print(f"[topologies/generate] Parsed spec: {spec.model_dump_json(indent=2)}")

        # Check if prompt wasn't understood (no components)
        if not spec.components:
            topology = get_hardcoded_topology()
            return GenerateResponse(
                topology=topology,
                validation=[
                    ValidationResult(
                        id="val-1",
                        severity=Severity.WARNING,
                        message="Couldn't understand the prompt. Showing example topology.",
                    ),
                    ValidationResult(
                        id="val-hint-1",
                        severity=Severity.INFO,
                        message="💡 Try describing your infrastructure needs, for example:",
                    ),
                    ValidationResult(
                        id="val-hint-2",
                        severity=Severity.INFO,
                        message="• 'Create a VPC with 2 web servers and a PostgreSQL database'",
                    ),
                    ValidationResult(
                        id="val-hint-3",
                        severity=Severity.INFO,
                        message="• 'Deploy 3 EC2 instances with RDS in us-west-2'",
                    ),
                    ValidationResult(
                        id="val-hint-4",
                        severity=Severity.INFO,
                        message="• 'High availability web tier with MySQL'",
                    ),
                ],
            )

        # Step 2: Build TopologyGraph from spec
        topology = build_topology_from_spec(spec)
        print(f"[topologies/generate] Built topology with {len(topology.nodes)} nodes, {len(topology.edges)} edges")

        # Start with info messages about what was generated
        validation = [
            ValidationResult(
                id="val-1",
                severity=Severity.INFO,
                message=f"✅ Topology generated with {len(topology.nodes)} resources",
            ),
            ValidationResult(
                id="val-2",
                severity=Severity.INFO,
                message=f"📍 Region: {spec.region}",
            ),
        ]

        # Add component info to validation
        for i, comp in enumerate(spec.components):
            validation.append(
                ValidationResult(
                    id=f"val-comp-{i}",
                    severity=Severity.INFO,
                    message=f"• {comp.role.value}: {comp.description} (qty: {comp.quantity or 'default'})",
                )
            )

        # Phase 3: Run validation passes
        from app.validation import run_all_validations
        validation_results = run_all_validations(topology)
        
        if validation_results:
            validation.append(
                ValidationResult(
                    id="val-separator",
                    severity=Severity.INFO,
                    message="─── Validation Results ───",
                )
            )
            validation.extend(validation_results)
        else:
            validation.append(
                ValidationResult(
                    id="val-all-good",
                    severity=Severity.INFO,
                    message="✓ All validation checks passed",
                )
            )

        return GenerateResponse(topology=topology, validation=validation)

    except Exception as e:
        print(f"[topologies/generate] Error: {e}")
        # Fall back to hardcoded topology on error
        topology = get_hardcoded_topology()
        return GenerateResponse(
            topology=topology,
            validation=[
                ValidationResult(
                    id="val-err",
                    severity=Severity.WARNING,
                    message=f"Failed to parse prompt, using default topology: {str(e)}",
                ),
            ],
        )


class GenerateFromSpecRequest(BaseModel):
    spec: dict


@router.post("/generate-from-spec", response_model=GenerateResponse)
async def generate_from_spec(request: GenerateFromSpecRequest) -> GenerateResponse:
    """Generate a topology from a pre-built TopologySpec (from chat)."""
    from app.core.builder import build_topology_from_spec, TopologySpec

    print(f"[topologies/generate-from-spec] Received spec: {request.spec}")

    try:
        # Convert dict to TopologySpec
        spec = TopologySpec.model_validate(request.spec)
        print(f"[topologies/generate-from-spec] Validated spec: {spec.model_dump_json(indent=2)}")

        # Build topology from spec
        topology = build_topology_from_spec(spec)
        print(f"[topologies/generate-from-spec] Built topology with {len(topology.nodes)} nodes, {len(topology.edges)} edges")

        validation = [
            ValidationResult(
                id="val-1",
                severity=Severity.INFO,
                message=f"✅ Topology generated with {len(topology.nodes)} resources",
            ),
            ValidationResult(
                id="val-2",
                severity=Severity.INFO,
                message=f"📍 Region: {spec.region}",
            ),
        ]

        # Add component info to validation
        for i, comp in enumerate(spec.components):
            validation.append(
                ValidationResult(
                    id=f"val-comp-{i}",
                    severity=Severity.INFO,
                    message=f"• {comp.role.value}: {comp.description} (qty: {comp.quantity or 'default'})",
                )
            )

        # Phase 3: Run validation passes
        from app.validation import run_all_validations
        validation_results = run_all_validations(topology)
        
        if validation_results:
            validation.append(
                ValidationResult(
                    id="val-separator",
                    severity=Severity.INFO,
                    message="─── Validation Results ───",
                )
            )
            validation.extend(validation_results)
        else:
            validation.append(
                ValidationResult(
                    id="val-all-good",
                    severity=Severity.INFO,
                    message="✓ All validation checks passed",
                )
            )

        return GenerateResponse(topology=topology, validation=validation)

    except Exception as e:
        print(f"[topologies/generate-from-spec] Error: {e}")
        topology = get_hardcoded_topology()
        return GenerateResponse(
            topology=topology,
            validation=[
                ValidationResult(
                    id="val-err",
                    severity=Severity.WARNING,
                    message=f"Failed to build topology from spec: {str(e)}",
                ),
            ],
        )


@router.post("/validate", response_model=ValidateResponse)
async def validate_topology(request: ValidateRequest) -> ValidateResponse:
    """Validate a topology graph."""
    from app.validation import run_all_validations
    
    validation: list[ValidationResult] = []

    # Basic checks
    if not request.topology.nodes:
        validation.append(
            ValidationResult(
                id="val-err-1",
                severity=Severity.ERROR,
                message="Topology must have at least one node",
            )
        )
        return ValidateResponse(validation=validation)

    # Run all validation passes
    validation_results = run_all_validations(request.topology)
    
    if validation_results:
        validation.extend(validation_results)
    else:
        validation.append(
            ValidationResult(
                id="val-ok",
                severity=Severity.INFO,
                message="✓ All validation checks passed",
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


class CostEstimateRequest(BaseModel):
    topology: TopologyGraph


class CostItem(BaseModel):
    resource: str
    type: str
    hourly: float
    monthly: float


class CostEstimateResponse(BaseModel):
    items: list[CostItem]
    hourly_total: float
    monthly_total: float
    currency: str
    note: str
    free_tier_note: str | None = None


@router.post("/estimate-cost", response_model=CostEstimateResponse)
async def estimate_cost(request: CostEstimateRequest) -> CostEstimateResponse:
    """Estimate monthly cost for a topology."""
    from app.core.pricing import estimate_topology_cost
    
    cost_data = estimate_topology_cost(request.topology)
    
    return CostEstimateResponse(
        items=[CostItem(**item) for item in cost_data["items"]],
        hourly_total=cost_data["hourly_total"],
        monthly_total=cost_data["monthly_total"],
        currency=cost_data["currency"],
        note=cost_data["note"],
        free_tier_note=cost_data.get("free_tier_note"),
    )
