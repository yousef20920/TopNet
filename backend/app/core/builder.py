# app/core/builder.py
"""Build TopologyGraph from TopologySpec - pure, deterministic logic."""

from datetime import datetime, timezone
from typing import Any

from app.core.types import (
    BaseNode,
    Edge,
    EdgeKind,
    NodeKind,
    Provider,
    TopologyGraph,
)
from app.core.spec import ComponentRole, ComponentSpec, TopologySpec


class TopologyBuilder:
    """Builds a TopologyGraph from a TopologySpec."""

    def __init__(self, spec: TopologySpec):
        self.spec = spec
        self.nodes: list[BaseNode] = []
        self.edges: list[Edge] = []
        self.subnet_counter = 0
        self.edge_counter = 0
        self.vpc_id: str | None = None
        self.igw_id: str | None = None
        self.nat_id: str | None = None
        self.public_subnet_ids: list[str] = []
        self.private_subnet_ids: list[str] = []
        self.web_sg_id: str | None = None
        self.db_sg_id: str | None = None
        self.alb_sg_id: str | None = None

        # Detect complexity tier
        self.tier = self._detect_complexity_tier()

    def _detect_complexity_tier(self) -> int:
        """
        Detect complexity tier based on user intent.

        TIER 1 (Hobby/MVP/Student - ~$5-30/mo):
          - Triggers: "simple", "cheap", "small", "test", "mvp", "hobby", "learning", "student"
          - OR: No explicit HA/production requirements
          - Architecture: 1 AZ, Public Subnets, IGW only, NO NAT, NO ALB

        TIER 2 (Production - ~$70+/mo):
          - Triggers: "production", "high availability", "ha", "multi-az", "secure", "enterprise"
          - Architecture: 2 AZs, Private Subnets for DB, NAT Gateway, ALB

        DEFAULT: TIER 1 (assume hobby/learning unless explicitly stated otherwise)
        """
        # Gather all descriptions for analysis
        all_text = " ".join([
            (c.description or "").lower()
            for c in self.spec.components
        ]).lower()

        # TIER 2 triggers (production/HA keywords)
        tier2_keywords = [
            "production", "prod", "high availability", "highly available",
            "ha", "multi-az", "multi az", "fault tolerant", "redundant",
            "enterprise", "mission critical", "99.9", "uptime",
            "load balancer", "load balanced", "alb", "scaling"
        ]

        # TIER 1 triggers (explicit simplicity)
        tier1_keywords = [
            "simple", "cheap", "budget", "small", "test", "testing",
            "mvp", "prototype", "hobby", "learning", "student", "practice",
            "minimal", "basic", "single", "one instance", "just one"
        ]

        # Check for explicit TIER 2 requests
        if any(kw in all_text for kw in tier2_keywords):
            return 2

        # Check for explicit TIER 1 requests
        if any(kw in all_text for kw in tier1_keywords):
            return 1

        # Check quantity - if user explicitly requests 2+ instances, assume TIER 2
        web_comps = [c for c in self.spec.components if c.role == ComponentRole.WEB_TIER]
        if web_comps:
            for comp in web_comps:
                if comp.quantity and comp.quantity >= 2:
                    return 2

        # DEFAULT TO TIER 1 (hobby/learning)
        # This is the critical change - we assume users want cheap unless they say otherwise
        return 1

    def build(self) -> TopologyGraph:
        """Build the complete topology graph from spec."""
        # Use tier-based architecture
        if self.tier == 1:
            return self._build_tier1()  # Hobby/MVP - cheap architecture
        else:
            return self._build_tier2()  # Production - HA architecture
    
    def _build_tier1(self) -> TopologyGraph:
        """
        Build TIER 1 (Hobby/MVP) topology.

        Architecture:
        - 1 Availability Zone
        - Public Subnets ONLY (EC2 gets public IP automatically)
        - Internet Gateway (IGW) for outbound internet
        - NO NAT Gateway (saves $32/mo)
        - NO Load Balancer (saves $16/mo)
        - Database in Public Subnet (acceptable for hobby projects)

        Cost: ~$5-30/mo depending on instance sizes
        """
        # Create minimal VPC
        self._create_vpc()
        self._create_internet_gateway()

        # Single public subnet
        self._create_single_public_subnet()

        # Simple route table
        self._create_simple_route_table()

        # Check what components we need
        has_web_tier = any(c.role == ComponentRole.WEB_TIER for c in self.spec.components)
        has_db_tier = any(c.role == ComponentRole.DB_TIER for c in self.spec.components)

        # Create security groups
        if has_web_tier:
            self._create_simple_security_group()

        if has_db_tier:
            self._create_simple_db_security_group()

        # Create EC2 instance(s) in public subnet
        if has_web_tier:
            web_quantity = self._get_quantity(ComponentRole.WEB_TIER)
            self._create_simple_ec2_instances(web_quantity)

        # Create RDS in public subnet (TIER 1 only - not recommended for production)
        if has_db_tier:
            self._create_simple_rds()

        return TopologyGraph(
            id=f"topo-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            name=f"Tier 1 (Hobby) - {self.spec.region}",
            nodes=self.nodes,
            edges=self.edges,
            metadata={
                "created_at": datetime.now(timezone.utc).isoformat(),
                "version": "0.1.0",
                "tier": 1,
                "mode": "hobby",
                "spec": self.spec.model_dump(),
            },
        )
    
    def _build_tier2(self) -> TopologyGraph:
        """
        Build TIER 2 (Production) topology.

        Architecture:
        - 2 Availability Zones (High Availability)
        - Public Subnets for ALB
        - Private Subnets for EC2 and RDS (security best practice)
        - NAT Gateway for private subnet internet access
        - Application Load Balancer for traffic distribution
        - Database isolated in private subnet

        Cost: ~$70+/mo (NAT: $32/mo, ALB: $16/mo, instances, RDS)
        """
        # Always create base networking
        self._create_vpc()
        self._create_internet_gateway()

        # Analyze components to determine what to create
        has_web_tier = any(c.role == ComponentRole.WEB_TIER for c in self.spec.components)
        has_db_tier = any(c.role == ComponentRole.DB_TIER for c in self.spec.components)
        web_quantity = self._get_quantity(ComponentRole.WEB_TIER)
        db_quantity = self._get_quantity(ComponentRole.DB_TIER)

        # Create subnets based on requirements
        num_azs = 2  # Default to 2 AZs for HA
        
        if has_web_tier:
            # Create public subnets for ALB
            self._create_public_subnets(num_azs)
            # Create private subnets for web tier
            self._create_private_subnets(num_azs, tier="web")
            # Create NAT for private subnet outbound
            self._create_nat_gateway()

        if has_db_tier:
            # Create database subnets
            self._create_private_subnets(num_azs, tier="db")

        # Create route tables
        self._create_route_tables()

        # Create security groups
        if has_web_tier:
            self._create_alb_security_group()
            self._create_web_security_group()

        if has_db_tier:
            self._create_db_security_group()

        # Create load balancer if we have web tier
        if has_web_tier:
            self._create_alb()

        # Create EC2 instances for web tier
        if has_web_tier:
            self._create_web_instances(web_quantity)

        # Create RDS for db tier
        if has_db_tier:
            self._create_rds(db_quantity)

        return TopologyGraph(
            id=f"topo-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            name=f"Tier 2 (Production) - {self.spec.region}",
            nodes=self.nodes,
            edges=self.edges,
            metadata={
                "created_at": datetime.now(timezone.utc).isoformat(),
                "version": "0.1.0",
                "tier": 2,
                "mode": "production",
                "spec": self.spec.model_dump(),
            },
        )

    def _get_quantity(self, role: ComponentRole) -> int:
        """Get quantity for a component role, defaulting to sensible values."""
        for comp in self.spec.components:
            if comp.role == role and comp.quantity:
                return comp.quantity
        # Defaults based on tier
        if role == ComponentRole.WEB_TIER:
            # TIER 1: Default to 1 instance (cheap)
            # TIER 2: Default to 2 instances (HA)
            return 2 if self.tier == 2 else 1
        if role == ComponentRole.DB_TIER:
            return 1
        return 1

    def _get_constraints(self, role: ComponentRole) -> dict[str, Any]:
        """Get constraints for a component role."""
        for comp in self.spec.components:
            if comp.role == role and comp.constraints:
                return comp.constraints
        return {}

    def _next_subnet_cidr(self) -> str:
        """Allocate next subnet CIDR block."""
        cidr = f"10.0.{self.subnet_counter}.0/24"
        self.subnet_counter += 1
        return cidr

    def _next_edge_id(self) -> str:
        """Generate next edge ID."""
        self.edge_counter += 1
        return f"e{self.edge_counter}"

    def _add_node(self, node: BaseNode) -> None:
        """Add a node to the graph."""
        self.nodes.append(node)

    def _add_edge(self, kind: EdgeKind, from_node: str, to_node: str, props: dict | None = None) -> None:
        """Add an edge to the graph."""
        self.edges.append(
            Edge(
                id=self._next_edge_id(),
                kind=kind,
                from_node=from_node,
                to_node=to_node,
                props=props,
            )
        )

    def _create_vpc(self) -> None:
        """Create the VPC node."""
        self.vpc_id = "vpc-main"
        self._add_node(
            BaseNode(
                id=self.vpc_id,
                kind=NodeKind.NETWORK,
                name="main-vpc",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "cidr_block": "10.0.0.0/16",
                    "enable_dns_hostnames": True,
                    "enable_dns_support": True,
                },
                tags={"Name": "topnet-vpc", "ManagedBy": "TopNet"},
            )
        )

    def _create_internet_gateway(self) -> None:
        """Create the Internet Gateway."""
        self.igw_id = "igw-main"
        self._add_node(
            BaseNode(
                id=self.igw_id,
                kind=NodeKind.GATEWAY,
                name="main-igw",
                provider=Provider.AWS,
                region=self.spec.region,
                props={"gateway_type": "internet"},
                tags={"Name": "topnet-igw", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.igw_id, self.vpc_id)

    # ========== SIMPLE MODE METHODS ==========
    
    def _create_single_public_subnet(self) -> None:
        """Create a single public subnet for simple mode."""
        az = f"{self.spec.region}a"
        subnet_id = "subnet-public"
        self.public_subnet_ids.append(subnet_id)
        self._add_node(
            BaseNode(
                id=subnet_id,
                kind=NodeKind.SUBNET,
                name="public-subnet",
                provider=Provider.AWS,
                region=self.spec.region,
                az=az,
                props={
                    "cidr_block": "10.0.1.0/24",
                    "is_public": True,
                    "map_public_ip_on_launch": True,
                },
                tags={"Name": "topnet-public", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, subnet_id, self.vpc_id)

    def _create_simple_route_table(self) -> None:
        """Create a simple route table pointing to IGW."""
        rt_id = "rt-main"
        self._add_node(
            BaseNode(
                id=rt_id,
                kind=NodeKind.ROUTE_TABLE,
                name="main-rt",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "routes": [{"destination": "0.0.0.0/0", "target": self.igw_id}],
                },
                tags={"Name": "topnet-rt", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, rt_id, self.vpc_id)
        self._add_edge(EdgeKind.ROUTES_TO, rt_id, self.igw_id)

    def _create_simple_security_group(self) -> None:
        """Create a simple security group for basic web access."""
        self.web_sg_id = "sg-web"
        self._add_node(
            BaseNode(
                id=self.web_sg_id,
                kind=NodeKind.SECURITY_GROUP,
                name="web-sg",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "description": "Security group for web access",
                    "ingress": [
                        {"from_port": 80, "to_port": 80, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                        {"from_port": 443, "to_port": 443, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                        {"from_port": 22, "to_port": 22, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                    ],
                    "egress": [
                        {"from_port": 0, "to_port": 0, "protocol": "-1", "cidr_blocks": ["0.0.0.0/0"]},
                    ],
                },
                tags={"Name": "topnet-web-sg", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.web_sg_id, self.vpc_id)

    def _create_simple_ec2_instances(self, quantity: int) -> None:
        """Create EC2 instances in public subnet (simple mode)."""
        constraints = self._get_constraints(ComponentRole.WEB_TIER)
        instance_type = constraints.get("instance_type", "t3.micro")

        for i in range(quantity):
            ec2_id = f"ec2-{i + 1}" if quantity > 1 else "ec2-instance"
            ec2_name = f"instance-{i + 1}" if quantity > 1 else "test-instance"
            self._add_node(
                BaseNode(
                    id=ec2_id,
                    kind=NodeKind.COMPUTE_INSTANCE,
                    name=ec2_name,
                    provider=Provider.AWS,
                    region=self.spec.region,
                    az=f"{self.spec.region}a",
                    props={
                        "instance_type": instance_type,
                        "subnet_id": self.public_subnet_ids[0],
                        "security_groups": [self.web_sg_id],
                        "associate_public_ip": True,
                    },
                    tags={"Name": f"topnet-{ec2_name}", "ManagedBy": "TopNet"},
                )
            )
            self._add_edge(EdgeKind.ATTACHED_TO, ec2_id, self.public_subnet_ids[0])
            if self.web_sg_id:
                self._add_edge(EdgeKind.PROTECTED_BY, ec2_id, self.web_sg_id)

    def _create_simple_db_security_group(self) -> None:
        """Create a simple security group for database (allows access from web SG)."""
        # Determine DB port from constraints
        constraints = self._get_constraints(ComponentRole.DB_TIER)
        engine = constraints.get("engine", "postgres")
        db_port = 5432 if engine == "postgres" else 3306

        self.db_sg_id = "sg-db"
        ingress_rules = []

        # Allow access from web security group if it exists
        if self.web_sg_id:
            ingress_rules.append({
                "from_port": db_port,
                "to_port": db_port,
                "protocol": "tcp",
                "source_security_group": self.web_sg_id,
            })
        else:
            # Fallback: allow from VPC CIDR
            ingress_rules.append({
                "from_port": db_port,
                "to_port": db_port,
                "protocol": "tcp",
                "cidr_blocks": ["10.0.0.0/16"],
            })

        self._add_node(
            BaseNode(
                id=self.db_sg_id,
                kind=NodeKind.SECURITY_GROUP,
                name="db-sg",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "description": "Security group for database",
                    "ingress": ingress_rules,
                    "egress": [],  # No outbound needed for database
                },
                tags={"Name": "topnet-db-sg", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.db_sg_id, self.vpc_id)

        # Web -> DB traffic allowed
        if self.web_sg_id:
            self._add_edge(EdgeKind.ALLOWED_TRAFFIC, self.web_sg_id, self.db_sg_id, {"ports": [db_port]})

    def _create_simple_rds(self) -> None:
        """Create RDS database in public subnet (TIER 1 only - not recommended for production)."""
        if not self.db_sg_id or not self.public_subnet_ids:
            return

        constraints = self._get_constraints(ComponentRole.DB_TIER)
        engine = constraints.get("engine", "postgres")
        engine_version = constraints.get("engine_version", "15.4" if engine == "postgres" else "8.0")
        instance_class = constraints.get("instance_class", "db.t3.micro")
        storage = constraints.get("allocated_storage", 20)

        rds_id = "rds-main"
        self._add_node(
            BaseNode(
                id=rds_id,
                kind=NodeKind.DATABASE,
                name="main-db",
                provider=Provider.AWS,
                region=self.spec.region,
                az=f"{self.spec.region}a",
                props={
                    "engine": engine,
                    "engine_version": engine_version,
                    "instance_class": instance_class,
                    "allocated_storage": storage,
                    "subnet_ids": [self.public_subnet_ids[0]],  # Public subnet for TIER 1
                    "security_groups": [self.db_sg_id],
                    "multi_az": False,
                    "publicly_accessible": False,  # Still not internet-facing, just in public subnet
                },
                tags={"Name": "topnet-db", "ManagedBy": "TopNet", "Tier": "1"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, rds_id, self.public_subnet_ids[0])

    # ========== FULL MODE METHODS ==========

    def _create_public_subnets(self, num_azs: int) -> None:
        """Create public subnets across AZs."""
        azs = self._get_azs(num_azs)
        for i, az in enumerate(azs):
            subnet_id = f"subnet-public-{i + 1}"
            self.public_subnet_ids.append(subnet_id)
            self._add_node(
                BaseNode(
                    id=subnet_id,
                    kind=NodeKind.SUBNET,
                    name=f"public-subnet-{i + 1}",
                    provider=Provider.AWS,
                    region=self.spec.region,
                    az=az,
                    props={
                        "cidr_block": self._next_subnet_cidr(),
                        "is_public": True,
                        "map_public_ip_on_launch": True,
                    },
                    tags={"Name": f"topnet-public-{i + 1}", "Tier": "public", "ManagedBy": "TopNet"},
                )
            )
            self._add_edge(EdgeKind.ATTACHED_TO, subnet_id, self.vpc_id)

    def _create_private_subnets(self, num_azs: int, tier: str = "private") -> None:
        """Create private subnets across AZs."""
        azs = self._get_azs(num_azs)
        for i, az in enumerate(azs):
            subnet_id = f"subnet-{tier}-{i + 1}"
            self.private_subnet_ids.append(subnet_id)
            self._add_node(
                BaseNode(
                    id=subnet_id,
                    kind=NodeKind.SUBNET,
                    name=f"{tier}-subnet-{i + 1}",
                    provider=Provider.AWS,
                    region=self.spec.region,
                    az=az,
                    props={
                        "cidr_block": self._next_subnet_cidr(),
                        "is_public": False,
                        "map_public_ip_on_launch": False,
                    },
                    tags={"Name": f"topnet-{tier}-{i + 1}", "Tier": tier, "ManagedBy": "TopNet"},
                )
            )
            self._add_edge(EdgeKind.ATTACHED_TO, subnet_id, self.vpc_id)

    def _create_nat_gateway(self) -> None:
        """Create NAT Gateway in first public subnet."""
        if not self.public_subnet_ids:
            return
        
        # Find the AZ of the first public subnet
        subnet_node = next((n for n in self.nodes if n.id == self.public_subnet_ids[0]), None)
        nat_az = subnet_node.az if subnet_node else None
        
        self.nat_id = "nat-main"
        self._add_node(
            BaseNode(
                id=self.nat_id,
                kind=NodeKind.GATEWAY,
                name="nat-gateway",
                provider=Provider.AWS,
                region=self.spec.region,
                az=nat_az,
                props={
                    "gateway_type": "nat",
                    "subnet_id": self.public_subnet_ids[0],
                },
                tags={"Name": "topnet-nat", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.nat_id, self.public_subnet_ids[0])

    def _create_route_tables(self) -> None:
        """Create route tables for public and private subnets."""
        # Public route table -> IGW
        rt_public_id = "rt-public"
        self._add_node(
            BaseNode(
                id=rt_public_id,
                kind=NodeKind.ROUTE_TABLE,
                name="public-rt",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "routes": [{"destination": "0.0.0.0/0", "target": self.igw_id}],
                },
                tags={"Name": "topnet-public-rt", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, rt_public_id, self.vpc_id)
        self._add_edge(EdgeKind.ROUTES_TO, rt_public_id, self.igw_id)

        # Private route table -> NAT (if exists)
        if self.nat_id:
            rt_private_id = "rt-private"
            self._add_node(
                BaseNode(
                    id=rt_private_id,
                    kind=NodeKind.ROUTE_TABLE,
                    name="private-rt",
                    provider=Provider.AWS,
                    region=self.spec.region,
                    props={
                        "routes": [{"destination": "0.0.0.0/0", "target": self.nat_id}],
                    },
                    tags={"Name": "topnet-private-rt", "ManagedBy": "TopNet"},
                )
            )
            self._add_edge(EdgeKind.ATTACHED_TO, rt_private_id, self.vpc_id)
            self._add_edge(EdgeKind.ROUTES_TO, rt_private_id, self.nat_id)

    def _create_alb_security_group(self) -> None:
        """Create security group for ALB."""
        self.alb_sg_id = "sg-alb"
        self._add_node(
            BaseNode(
                id=self.alb_sg_id,
                kind=NodeKind.SECURITY_GROUP,
                name="alb-sg",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "description": "Security group for Application Load Balancer",
                    "ingress": [
                        {"from_port": 80, "to_port": 80, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                        {"from_port": 443, "to_port": 443, "protocol": "tcp", "cidr_blocks": ["0.0.0.0/0"]},
                    ],
                    "egress": [
                        {"from_port": 0, "to_port": 0, "protocol": "-1", "cidr_blocks": ["0.0.0.0/0"]},
                    ],
                },
                tags={"Name": "topnet-alb-sg", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.alb_sg_id, self.vpc_id)

    def _create_web_security_group(self) -> None:
        """Create security group for web tier."""
        self.web_sg_id = "sg-web"
        self._add_node(
            BaseNode(
                id=self.web_sg_id,
                kind=NodeKind.SECURITY_GROUP,
                name="web-sg",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "description": "Security group for web tier",
                    "ingress": [
                        {"from_port": 80, "to_port": 80, "protocol": "tcp", "source_security_group": self.alb_sg_id},
                        {"from_port": 443, "to_port": 443, "protocol": "tcp", "source_security_group": self.alb_sg_id},
                        {"from_port": 22, "to_port": 22, "protocol": "tcp", "cidr_blocks": ["10.0.0.0/16"]},  # SSH from VPC
                    ],
                    "egress": [
                        {"from_port": 0, "to_port": 0, "protocol": "-1", "cidr_blocks": ["0.0.0.0/0"]},
                    ],
                },
                tags={"Name": "topnet-web-sg", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.web_sg_id, self.vpc_id)
        # ALB -> Web traffic allowed
        self._add_edge(EdgeKind.ALLOWED_TRAFFIC, self.alb_sg_id, self.web_sg_id, {"ports": [80, 443]})

    def _create_db_security_group(self) -> None:
        """Create security group for database tier."""
        self.db_sg_id = "sg-db"
        
        # Determine DB port from constraints
        constraints = self._get_constraints(ComponentRole.DB_TIER)
        engine = constraints.get("engine", "postgres")
        db_port = 5432 if engine == "postgres" else 3306  # MySQL default
        
        ingress_rules = []
        if self.web_sg_id:
            ingress_rules.append({
                "from_port": db_port,
                "to_port": db_port,
                "protocol": "tcp",
                "source_security_group": self.web_sg_id,
            })
        
        self._add_node(
            BaseNode(
                id=self.db_sg_id,
                kind=NodeKind.SECURITY_GROUP,
                name="db-sg",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "description": "Security group for database tier",
                    "ingress": ingress_rules,
                    "egress": [],  # No outbound by default
                },
                tags={"Name": "topnet-db-sg", "ManagedBy": "TopNet"},
            )
        )
        self._add_edge(EdgeKind.ATTACHED_TO, self.db_sg_id, self.vpc_id)
        
        # Web -> DB traffic allowed
        if self.web_sg_id:
            self._add_edge(EdgeKind.ALLOWED_TRAFFIC, self.web_sg_id, self.db_sg_id, {"ports": [db_port]})

    def _create_alb(self) -> None:
        """Create Application Load Balancer."""
        if not self.public_subnet_ids or not self.alb_sg_id:
            return
        
        alb_id = "alb-web"
        self._add_node(
            BaseNode(
                id=alb_id,
                kind=NodeKind.LOAD_BALANCER,
                name="web-alb",
                provider=Provider.AWS,
                region=self.spec.region,
                props={
                    "lb_type": "application",
                    "scheme": "internet-facing",
                    "subnets": self.public_subnet_ids,
                    "security_groups": [self.alb_sg_id],
                },
                tags={"Name": "topnet-web-alb", "ManagedBy": "TopNet"},
            )
        )
        # ALB attached to public subnets
        for subnet_id in self.public_subnet_ids:
            self._add_edge(EdgeKind.ATTACHED_TO, alb_id, subnet_id)

    def _create_web_instances(self, quantity: int) -> None:
        """Create EC2 instances for web tier."""
        if not self.private_subnet_ids or not self.web_sg_id:
            return
        
        # Get web tier constraints
        constraints = self._get_constraints(ComponentRole.WEB_TIER)
        instance_type = constraints.get("instance_type", "t3.micro")
        
        # Distribute instances across private subnets
        web_subnets = [s for s in self.private_subnet_ids if "web" in s]
        if not web_subnets:
            web_subnets = self.private_subnet_ids[:2]  # Use first 2 private subnets
        
        for i in range(quantity):
            subnet_id = web_subnets[i % len(web_subnets)]
            # Find AZ from subnet
            subnet_node = next((n for n in self.nodes if n.id == subnet_id), None)
            az = subnet_node.az if subnet_node else f"{self.spec.region}a"
            
            ec2_id = f"ec2-web-{i + 1}"
            self._add_node(
                BaseNode(
                    id=ec2_id,
                    kind=NodeKind.COMPUTE_INSTANCE,
                    name=f"web-server-{i + 1}",
                    provider=Provider.AWS,
                    region=self.spec.region,
                    az=az,
                    props={
                        "instance_type": instance_type,
                        "subnet_id": subnet_id,
                        "security_groups": [self.web_sg_id],
                    },
                    tags={"Name": f"topnet-web-{i + 1}", "Role": "web", "ManagedBy": "TopNet"},
                )
            )
            self._add_edge(EdgeKind.ATTACHED_TO, ec2_id, subnet_id)

    def _create_rds(self, quantity: int = 1) -> None:
        """Create RDS database instance."""
        if not self.db_sg_id:
            return
        
        # Get db tier constraints
        constraints = self._get_constraints(ComponentRole.DB_TIER)
        engine = constraints.get("engine", "postgres")
        engine_version = constraints.get("engine_version", "15.4" if engine == "postgres" else "8.0")
        instance_class = constraints.get("instance_class", "db.t3.micro")
        storage = constraints.get("allocated_storage", 20)
        
        # Find db subnets
        db_subnets = [s for s in self.private_subnet_ids if "db" in s]
        if not db_subnets:
            db_subnets = self.private_subnet_ids[-2:] if len(self.private_subnet_ids) >= 2 else self.private_subnet_ids
        
        for i in range(quantity):
            subnet_id = db_subnets[i % len(db_subnets)] if db_subnets else None
            subnet_node = next((n for n in self.nodes if n.id == subnet_id), None) if subnet_id else None
            az = subnet_node.az if subnet_node else f"{self.spec.region}a"
            
            rds_id = f"rds-{i + 1}"
            self._add_node(
                BaseNode(
                    id=rds_id,
                    kind=NodeKind.DATABASE,
                    name=f"main-db-{i + 1}" if quantity > 1 else "main-db",
                    provider=Provider.AWS,
                    region=self.spec.region,
                    az=az,
                    props={
                        "engine": engine,
                        "engine_version": engine_version,
                        "instance_class": instance_class,
                        "allocated_storage": storage,
                        "subnet_ids": db_subnets,
                        "security_groups": [self.db_sg_id],
                        "multi_az": False,
                    },
                    tags={"Name": f"topnet-db-{i + 1}" if quantity > 1 else "topnet-db", "ManagedBy": "TopNet"},
                )
            )
            if subnet_id:
                self._add_edge(EdgeKind.ATTACHED_TO, rds_id, subnet_id)

    def _get_azs(self, num_azs: int) -> list[str]:
        """Get availability zones for the region."""
        az_suffixes = ["a", "b", "c", "d", "e", "f"]
        return [f"{self.spec.region}{az_suffixes[i]}" for i in range(num_azs)]


def build_topology_from_spec(spec: TopologySpec) -> TopologyGraph:
    """Build a TopologyGraph from a TopologySpec."""
    builder = TopologyBuilder(spec)
    return builder.build()
