# app/terraform/aws/generator.py
"""Generate Terraform JSON for AWS resources from TopologyGraph."""

import json
from typing import Any

from app.core import TopologyGraph, BaseNode, NodeKind


class TerraformGenerator:
    """Generate Terraform JSON from TopologyGraph with proper resource references."""
    
    def __init__(self, graph: TopologyGraph):
        self.graph = graph
        self.resources: dict[str, Any] = {}
        
        # Find VPC and IGW node IDs for references
        self.vpc_id = self._find_node_id(NodeKind.NETWORK)
        self.igw_id = self._find_igw_id()
        
    def _find_node_id(self, kind: NodeKind) -> str | None:
        """Find the first node ID of a given kind."""
        for node in self.graph.nodes:
            if node.kind == kind:
                return node.id
        return None
    
    def _find_igw_id(self) -> str | None:
        """Find the Internet Gateway node ID."""
        for node in self.graph.nodes:
            if node.kind == NodeKind.GATEWAY and node.props.get("gateway_type") == "internet":
                return node.id
        return None
    
    def _vpc_ref(self) -> str:
        """Get Terraform reference to VPC."""
        if self.vpc_id:
            return f"${{aws_vpc.{_sanitize_name(self.vpc_id)}.id}}"
        return "${aws_vpc.vpc_main.id}"
    
    def _igw_ref(self) -> str:
        """Get Terraform reference to IGW."""
        if self.igw_id:
            return f"aws_internet_gateway.{_sanitize_name(self.igw_id)}"
        return "aws_internet_gateway.igw_main"
    
    def generate(self) -> dict[str, Any]:
        """Generate the complete Terraform configuration."""
        terraform_config: dict[str, Any] = {
            "terraform": {
                "required_providers": {
                    "aws": {
                        "source": "hashicorp/aws",
                        "version": "~> 5.0"
                    }
                }
            },
            "provider": {
                "aws": {
                    "region": self._get_region()
                }
            },
            "resource": self.resources
        }
        
        for node in self.graph.nodes:
            if node.kind == NodeKind.NETWORK:
                self._add_vpc(node)
            elif node.kind == NodeKind.SUBNET:
                self._add_subnet(node)
            elif node.kind == NodeKind.GATEWAY:
                self._add_gateway(node)
            elif node.kind == NodeKind.ROUTE_TABLE:
                self._add_route_table(node)
            elif node.kind == NodeKind.SECURITY_GROUP:
                self._add_security_group(node)
            elif node.kind == NodeKind.LOAD_BALANCER:
                self._add_alb(node)
            elif node.kind == NodeKind.COMPUTE_INSTANCE:
                self._add_ec2(node)
            elif node.kind == NodeKind.DATABASE:
                self._add_rds(node)
        
        # Add route table associations (must be done after route tables are created)
        self._add_route_table_associations()
        
        return terraform_config
    
    def _get_region(self) -> str:
        """Extract region from graph nodes."""
        for node in self.graph.nodes:
            if node.region:
                return node.region
        return "us-east-2"  # Default to Ohio
    
    def _add_vpc(self, node: BaseNode) -> None:
        """Add aws_vpc resource."""
        if "aws_vpc" not in self.resources:
            self.resources["aws_vpc"] = {}
        
        name = _sanitize_name(node.id)
        self.resources["aws_vpc"][name] = {
            "cidr_block": node.props.get("cidr_block", "10.0.0.0/16"),
            "enable_dns_hostnames": node.props.get("enable_dns_hostnames", True),
            "enable_dns_support": node.props.get("enable_dns_support", True),
            "tags": node.tags or {"Name": node.name or node.id}
        }
    
    def _add_subnet(self, node: BaseNode) -> None:
        """Add aws_subnet resource."""
        if "aws_subnet" not in self.resources:
            self.resources["aws_subnet"] = {}
        
        name = _sanitize_name(node.id)
        self.resources["aws_subnet"][name] = {
            "vpc_id": self._vpc_ref(),
            "cidr_block": node.props.get("cidr_block", "10.0.1.0/24"),
            "availability_zone": node.az or f"{node.region or 'us-east-1'}a",
            "map_public_ip_on_launch": node.props.get("map_public_ip_on_launch", False),
            "tags": node.tags or {"Name": node.name or node.id}
        }
    
    def _add_gateway(self, node: BaseNode) -> None:
        """Add aws_internet_gateway or aws_nat_gateway resource."""
        gateway_type = node.props.get("gateway_type", "internet")
        
        if gateway_type == "internet":
            if "aws_internet_gateway" not in self.resources:
                self.resources["aws_internet_gateway"] = {}
            
            name = _sanitize_name(node.id)
            self.resources["aws_internet_gateway"][name] = {
                "vpc_id": self._vpc_ref(),
                "tags": node.tags or {"Name": node.name or node.id}
            }
        elif gateway_type == "nat":
            # NAT Gateway needs an EIP
            if "aws_eip" not in self.resources:
                self.resources["aws_eip"] = {}
            if "aws_nat_gateway" not in self.resources:
                self.resources["aws_nat_gateway"] = {}
            
            name = _sanitize_name(node.id)
            eip_name = f"{name}_eip"
            
            self.resources["aws_eip"][eip_name] = {
                "domain": "vpc",
                "tags": {"Name": f"{node.name or node.id}-eip"}
            }
            
            subnet_id = node.props.get("subnet_id", "subnet-public-1")
            subnet_ref = f"${{aws_subnet.{_sanitize_name(subnet_id)}.id}}"
            
            self.resources["aws_nat_gateway"][name] = {
                "allocation_id": f"${{aws_eip.{eip_name}.id}}",
                "subnet_id": subnet_ref,
                "tags": node.tags or {"Name": node.name or node.id},
                "depends_on": [self._igw_ref()]
            }
    
    def _add_route_table(self, node: BaseNode) -> None:
        """Add aws_route_table resource and separate aws_route resources."""
        if "aws_route_table" not in self.resources:
            self.resources["aws_route_table"] = {}
        if "aws_route" not in self.resources:
            self.resources["aws_route"] = {}
        
        name = _sanitize_name(node.id)
        
        # Create route table without inline routes
        self.resources["aws_route_table"][name] = {
            "vpc_id": self._vpc_ref(),
            "tags": node.tags or {"Name": node.name or node.id}
        }
        
        # Create separate aws_route resources for each route
        for idx, route in enumerate(node.props.get("routes", [])):
            target = route.get("target", "")
            route_name = f"{name}_route_{idx}"
            
            route_config: dict[str, Any] = {
                "route_table_id": f"${{aws_route_table.{name}.id}}",
                "destination_cidr_block": route.get("destination", "0.0.0.0/0")
            }
            
            if "igw" in target:
                route_config["gateway_id"] = f"${{aws_internet_gateway.{_sanitize_name(target)}.id}}"
            elif "nat" in target:
                route_config["nat_gateway_id"] = f"${{aws_nat_gateway.{_sanitize_name(target)}.id}}"
            
            self.resources["aws_route"][route_name] = route_config
    
    def _add_route_table_associations(self) -> None:
        """Add aws_route_table_association resources based on graph edges."""
        associations = {}
        
        # Find all edges that connect route tables to subnets
        for edge in self.graph.edges:
            if edge.kind == "attached_to":
                # Check if this is a route table -> subnet association
                from_node = next((n for n in self.graph.nodes if n.id == edge.from_node), None)
                to_node = next((n for n in self.graph.nodes if n.id == edge.to_node), None)
                
                if from_node and to_node:
                    if from_node.kind == NodeKind.ROUTE_TABLE and to_node.kind == NodeKind.SUBNET:
                        assoc_name = f"{_sanitize_name(to_node.id)}_rt_assoc"
                        associations[assoc_name] = {
                            "subnet_id": f"${{aws_subnet.{_sanitize_name(to_node.id)}.id}}",
                            "route_table_id": f"${{aws_route_table.{_sanitize_name(from_node.id)}.id}}"
                        }
        
        # Only add the resource type if we have associations
        if associations:
            self.resources["aws_route_table_association"] = associations

    
    def _add_security_group(self, node: BaseNode) -> None:
        """Add aws_security_group resource and separate rule resources."""
        if "aws_security_group" not in self.resources:
            self.resources["aws_security_group"] = {}
        if "aws_security_group_rule" not in self.resources:
            self.resources["aws_security_group_rule"] = {}
        
        name = _sanitize_name(node.id)
        
        # Create security group without inline rules
        self.resources["aws_security_group"][name] = {
            "name": node.name or node.id,
            "description": node.props.get("description", f"Security group {node.name or node.id}"),
            "vpc_id": self._vpc_ref(),
            "tags": node.tags or {"Name": node.name or node.id}
        }
        
        # Create separate ingress rules
        for idx, rule in enumerate(node.props.get("ingress", [])):
            rule_name = f"{name}_ingress_{idx}"
            rule_config: dict[str, Any] = {
                "type": "ingress",
                "security_group_id": f"${{aws_security_group.{name}.id}}",
                "from_port": rule.get("from_port", 0),
                "to_port": rule.get("to_port", 0),
                "protocol": rule.get("protocol", "tcp"),
                "description": rule.get("description", "")
            }
            
            if "cidr_blocks" in rule:
                rule_config["cidr_blocks"] = rule["cidr_blocks"]
            elif "source_security_group" in rule:
                sg_ref = rule["source_security_group"]
                rule_config["source_security_group_id"] = f"${{aws_security_group.{_sanitize_name(sg_ref)}.id}}"
            
            self.resources["aws_security_group_rule"][rule_name] = rule_config
        
        # Create separate egress rules
        egress_rules = node.props.get("egress", [])
        if not egress_rules:
            # Default: allow all outbound
            egress_rules = [{
                "from_port": 0,
                "to_port": 0,
                "protocol": "-1",
                "cidr_blocks": ["0.0.0.0/0"],
                "description": "Allow all outbound"
            }]
        
        for idx, rule in enumerate(egress_rules):
            rule_name = f"{name}_egress_{idx}"
            self.resources["aws_security_group_rule"][rule_name] = {
                "type": "egress",
                "security_group_id": f"${{aws_security_group.{name}.id}}",
                "from_port": rule.get("from_port", 0),
                "to_port": rule.get("to_port", 0),
                "protocol": rule.get("protocol", "-1"),
                "cidr_blocks": rule.get("cidr_blocks", ["0.0.0.0/0"]),
                "description": rule.get("description", "")
            }
    
    def _add_alb(self, node: BaseNode) -> None:
        """Add aws_lb, aws_lb_target_group, and aws_lb_listener resources."""
        if "aws_lb" not in self.resources:
            self.resources["aws_lb"] = {}
        if "aws_lb_target_group" not in self.resources:
            self.resources["aws_lb_target_group"] = {}
        if "aws_lb_listener" not in self.resources:
            self.resources["aws_lb_listener"] = {}
        
        name = _sanitize_name(node.id)
        
        # Get subnet references
        subnet_ids = node.props.get("subnets", [])
        subnet_refs = [f"${{aws_subnet.{_sanitize_name(s)}.id}}" for s in subnet_ids]
        
        # Get security group references
        sg_ids = node.props.get("security_groups", [])
        sg_refs = [f"${{aws_security_group.{_sanitize_name(s)}.id}}" for s in sg_ids]
        
        self.resources["aws_lb"][name] = {
            "name": (node.name or node.id)[:32],  # ALB name max 32 chars
            "internal": node.props.get("scheme") != "internet-facing",
            "load_balancer_type": "application",
            "security_groups": sg_refs,
            "subnets": subnet_refs,
            "tags": node.tags or {"Name": node.name or node.id}
        }
        
        # Target group
        tg_name = f"{name}_tg"
        self.resources["aws_lb_target_group"][tg_name] = {
            "name": f"{(node.name or node.id)[:26]}-tg",
            "port": 80,
            "protocol": "HTTP",
            "vpc_id": self._vpc_ref(),
            "health_check": {
                "path": "/",
                "healthy_threshold": 2,
                "unhealthy_threshold": 10
            }
        }
        
        # Listener
        listener_name = f"{name}_listener"
        self.resources["aws_lb_listener"][listener_name] = {
            "load_balancer_arn": f"${{aws_lb.{name}.arn}}",
            "port": 80,
            "protocol": "HTTP",
            "default_action": {
                "type": "forward",
                "target_group_arn": f"${{aws_lb_target_group.{tg_name}.arn}}"
            }
        }
    
    def _add_ec2(self, node: BaseNode) -> None:
        """Add aws_instance resource."""
        if "aws_instance" not in self.resources:
            self.resources["aws_instance"] = {}
        
        name = _sanitize_name(node.id)
        
        # Get subnet reference
        subnet_id = node.props.get("subnet_id", "subnet-private-1")
        subnet_ref = f"${{aws_subnet.{_sanitize_name(subnet_id)}.id}}"
        
        # Get security group references
        sg_ids = node.props.get("security_groups", [])
        sg_refs = [f"${{aws_security_group.{_sanitize_name(s)}.id}}" for s in sg_ids]
        
        # Use Amazon Linux 2023 AMI
        instance_type = node.props.get("instance_type", "t3.micro")
        
        # Region-specific AMIs for Amazon Linux 2023
        region = node.region or "us-east-2"
        ami_map = {
            "us-east-1": "ami-0c7217cdde317cfec",
            "us-east-2": "ami-0900fe555666598a2",  # Ohio
            "us-west-1": "ami-0827b6c5b977c020e",
            "us-west-2": "ami-0f3769c8d8429942f",
            "ca-central-1": "ami-0a2e7efb4257c0907",  # Canada
            "eu-west-1": "ami-0694d931cee176e7d",
            "eu-central-1": "ami-0faab6bdbac9486fb",
        }
        ami = ami_map.get(region, ami_map["us-east-2"])  # Default to Ohio
        
        self.resources["aws_instance"][name] = {
            "ami": ami,
            "instance_type": instance_type,
            "subnet_id": subnet_ref,
            "vpc_security_group_ids": sg_refs,
            "tags": node.tags or {"Name": node.name or node.id}
        }
    
    def _add_rds(self, node: BaseNode) -> None:
        """Add aws_db_subnet_group and aws_db_instance resources."""
        from app.core import BaseNode as BNode, NodeKind as NK, Provider

        if "aws_db_subnet_group" not in self.resources:
            self.resources["aws_db_subnet_group"] = {}
        if "aws_db_instance" not in self.resources:
            self.resources["aws_db_instance"] = {}
        if "aws_subnet" not in self.resources:
            self.resources["aws_subnet"] = {}

        name = _sanitize_name(node.id)

        # Find all database subnets for the subnet group
        db_subnets = [n for n in self.graph.nodes if n.kind == NodeKind.SUBNET and "db" in n.id.lower()]
        if not db_subnets:
            # Fall back to private subnets
            db_subnets = [n for n in self.graph.nodes if n.kind == NodeKind.SUBNET and "private" in n.id.lower()]
        if not db_subnets:
            # Fall back to ANY subnet (for TIER 1 which only has public subnets)
            db_subnets = [n for n in self.graph.nodes if n.kind == NodeKind.SUBNET]

        subnet_refs = [f"${{aws_subnet.{_sanitize_name(s.id)}.id}}" for s in db_subnets]

        # RDS requires at least 2 subnets in different AZs
        # If we only have 1 subnet, auto-create a second one in a different AZ
        if len(subnet_refs) < 2 and len(db_subnets) == 1:
            original_subnet = db_subnets[0]

            # Find VPC CIDR to allocate new subnet
            vpc_node = next((n for n in self.graph.nodes if n.kind == NodeKind.NETWORK), None)
            if not vpc_node:
                # Can't create subnet without VPC, fall back to duplicating (will fail but at least try)
                subnet_refs = subnet_refs * 2
            else:
                # Create second subnet in different AZ
                second_subnet_id = f"{original_subnet.id}-az2"
                original_az = original_subnet.az or f"{original_subnet.region}a"
                # Change last character from 'a' to 'b' for different AZ
                second_az = original_az[:-1] + 'b'

                # Add second subnet to graph
                second_subnet = BNode(
                    id=second_subnet_id,
                    kind=NK.SUBNET,
                    name=f"{original_subnet.name}-az2" if original_subnet.name else f"{second_subnet_id}",
                    provider=Provider.AWS,
                    region=original_subnet.region,
                    az=second_az,
                    props={
                        "cidr_block": "10.0.2.0/24",  # Non-overlapping CIDR
                        "is_public": original_subnet.props.get("is_public", False),
                        "map_public_ip_on_launch": original_subnet.props.get("map_public_ip_on_launch", False),
                    },
                    tags={"Name": f"topnet-auto-{second_subnet_id}", "ManagedBy": "TopNet", "AutoCreated": "true"},
                )
                self.graph.nodes.append(second_subnet)

                # Add Terraform resource for second subnet
                subnet_tf_name = _sanitize_name(second_subnet_id)
                self.resources["aws_subnet"][subnet_tf_name] = {
                    "vpc_id": f"${{aws_vpc.{_sanitize_name(vpc_node.id)}.id}}",
                    "cidr_block": "10.0.2.0/24",
                    "availability_zone": second_az,
                    "map_public_ip_on_launch": second_subnet.props.get("map_public_ip_on_launch", False),
                    "tags": second_subnet.tags or {"Name": second_subnet.name or second_subnet.id}
                }

                # Add the new subnet to our reference list
                subnet_refs.append(f"${{aws_subnet.{subnet_tf_name}.id}}")
        
        sg_name = f"{name}_subnet_group"
        # Use a timestamp-based name to avoid conflicts
        import time
        timestamp = str(int(time.time()))
        db_sg_name = f"{(node.name or node.id)[:20]}-sg-{timestamp}"

        self.resources["aws_db_subnet_group"][sg_name] = {
            "name": db_sg_name,
            "subnet_ids": subnet_refs,
            "tags": {"Name": f"{node.name or node.id}-subnet-group"}
        }
        
        # Get security group references
        sg_ids = node.props.get("security_groups", [])
        sg_refs = [f"${{aws_security_group.{_sanitize_name(s)}.id}}" for s in sg_ids]
        
        self.resources["aws_db_instance"][name] = {
            "identifier": (node.name or node.id)[:63],
            "engine": node.props.get("engine", "postgres"),
            "engine_version": node.props.get("engine_version", "14"),
            "instance_class": node.props.get("instance_class", "db.t2.micro"),
            "allocated_storage": node.props.get("allocated_storage", 20),
            "db_name": "topnetdb",
            "username": "topnetadmin",
            "password": "TopNet2024!Secure",  # Should use secrets manager in production
            "db_subnet_group_name": f"${{aws_db_subnet_group.{sg_name}.name}}",
            "vpc_security_group_ids": sg_refs,
            "skip_final_snapshot": True,
            "publicly_accessible": False,
            "tags": node.tags or {"Name": node.name or node.id}
        }


def _sanitize_name(name: str) -> str:
    """Convert node ID to valid Terraform resource name."""
    return name.replace("-", "_")


def generate_aws_terraform(graph: TopologyGraph) -> dict[str, Any]:
    """Generate Terraform JSON configuration from a TopologyGraph."""
    generator = TerraformGenerator(graph)
    return generator.generate()


def terraform_to_json(config: dict[str, Any]) -> str:
    """Convert Terraform config dict to JSON string."""
    return json.dumps(config, indent=2)
