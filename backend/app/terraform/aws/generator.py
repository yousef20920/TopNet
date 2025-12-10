# app/terraform/aws/generator.py
"""Generate Terraform JSON for AWS resources from TopologyGraph."""

import json
from typing import Any

from app.core import TopologyGraph, BaseNode, NodeKind


def generate_aws_terraform(graph: TopologyGraph) -> dict[str, Any]:
    """Generate Terraform JSON configuration from a TopologyGraph."""
    
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
                "region": _get_region(graph)
            }
        },
        "resource": {}
    }
    
    resources = terraform_config["resource"]
    
    for node in graph.nodes:
        if node.kind == NodeKind.NETWORK:
            _add_vpc(resources, node)
        elif node.kind == NodeKind.SUBNET:
            _add_subnet(resources, node)
        elif node.kind == NodeKind.GATEWAY:
            _add_gateway(resources, node)
        elif node.kind == NodeKind.ROUTE_TABLE:
            _add_route_table(resources, node, graph)
        elif node.kind == NodeKind.SECURITY_GROUP:
            _add_security_group(resources, node)
        elif node.kind == NodeKind.LOAD_BALANCER:
            _add_alb(resources, node)
        elif node.kind == NodeKind.COMPUTE_INSTANCE:
            _add_ec2(resources, node)
        elif node.kind == NodeKind.DATABASE:
            _add_rds(resources, node, graph)
    
    return terraform_config


def _get_region(graph: TopologyGraph) -> str:
    """Extract region from graph nodes."""
    for node in graph.nodes:
        if node.region:
            return node.region
    return "us-east-1"


def _sanitize_name(name: str) -> str:
    """Convert node ID to valid Terraform resource name."""
    return name.replace("-", "_")


def _add_vpc(resources: dict, node: BaseNode) -> None:
    """Add aws_vpc resource."""
    if "aws_vpc" not in resources:
        resources["aws_vpc"] = {}
    
    name = _sanitize_name(node.id)
    resources["aws_vpc"][name] = {
        "cidr_block": node.props.get("cidr_block", "10.0.0.0/16"),
        "enable_dns_hostnames": node.props.get("enable_dns_hostnames", True),
        "enable_dns_support": node.props.get("enable_dns_support", True),
        "tags": node.tags or {"Name": node.name or node.id}
    }


def _add_subnet(resources: dict, node: BaseNode) -> None:
    """Add aws_subnet resource."""
    if "aws_subnet" not in resources:
        resources["aws_subnet"] = {}
    
    name = _sanitize_name(node.id)
    vpc_ref = "${aws_vpc.vpc_1.id}"  # Default to first VPC
    
    resources["aws_subnet"][name] = {
        "vpc_id": vpc_ref,
        "cidr_block": node.props.get("cidr_block", "10.0.1.0/24"),
        "availability_zone": node.az or f"{node.region or 'us-east-1'}a",
        "map_public_ip_on_launch": node.props.get("map_public_ip_on_launch", False),
        "tags": node.tags or {"Name": node.name or node.id}
    }


def _add_gateway(resources: dict, node: BaseNode) -> None:
    """Add aws_internet_gateway or aws_nat_gateway resource."""
    gateway_type = node.props.get("gateway_type", "internet")
    
    if gateway_type == "internet":
        if "aws_internet_gateway" not in resources:
            resources["aws_internet_gateway"] = {}
        
        name = _sanitize_name(node.id)
        resources["aws_internet_gateway"][name] = {
            "vpc_id": "${aws_vpc.vpc_1.id}",
            "tags": node.tags or {"Name": node.name or node.id}
        }
    elif gateway_type == "nat":
        # NAT Gateway needs an EIP
        if "aws_eip" not in resources:
            resources["aws_eip"] = {}
        if "aws_nat_gateway" not in resources:
            resources["aws_nat_gateway"] = {}
        
        name = _sanitize_name(node.id)
        eip_name = f"{name}_eip"
        
        resources["aws_eip"][eip_name] = {
            "domain": "vpc",
            "tags": {"Name": f"{node.name or node.id}-eip"}
        }
        
        subnet_id = node.props.get("subnet_id", "subnet-public-1")
        subnet_ref = f"${{aws_subnet.{_sanitize_name(subnet_id)}.id}}"
        
        resources["aws_nat_gateway"][name] = {
            "allocation_id": f"${{aws_eip.{eip_name}.id}}",
            "subnet_id": subnet_ref,
            "tags": node.tags or {"Name": node.name or node.id},
            "depends_on": [f"aws_internet_gateway.igw_1"]
        }


def _add_route_table(resources: dict, node: BaseNode, graph: TopologyGraph) -> None:
    """Add aws_route_table and aws_route_table_association resources."""
    if "aws_route_table" not in resources:
        resources["aws_route_table"] = {}
    
    name = _sanitize_name(node.id)
    routes = []
    
    for route in node.props.get("routes", []):
        target = route.get("target", "")
        route_config: dict[str, Any] = {
            "cidr_block": route.get("destination", "0.0.0.0/0")
        }
        
        if "igw" in target:
            route_config["gateway_id"] = f"${{aws_internet_gateway.{_sanitize_name(target)}.id}}"
        elif "nat" in target:
            route_config["nat_gateway_id"] = f"${{aws_nat_gateway.{_sanitize_name(target)}.id}}"
        
        routes.append(route_config)
    
    resources["aws_route_table"][name] = {
        "vpc_id": "${aws_vpc.vpc_1.id}",
        "route": routes,
        "tags": node.tags or {"Name": node.name or node.id}
    }


def _add_security_group(resources: dict, node: BaseNode) -> None:
    """Add aws_security_group resource."""
    if "aws_security_group" not in resources:
        resources["aws_security_group"] = {}
    
    name = _sanitize_name(node.id)
    
    ingress_rules = []
    for rule in node.props.get("ingress", []):
        ingress_rule: dict[str, Any] = {
            "from_port": rule.get("from_port", 0),
            "to_port": rule.get("to_port", 0),
            "protocol": rule.get("protocol", "tcp"),
            "description": rule.get("description", "")
        }
        
        if "cidr_blocks" in rule:
            ingress_rule["cidr_blocks"] = rule["cidr_blocks"]
        elif "source_security_group" in rule:
            sg_ref = rule["source_security_group"]
            ingress_rule["security_groups"] = [f"${{aws_security_group.{_sanitize_name(sg_ref)}.id}}"]
        
        ingress_rules.append(ingress_rule)
    
    egress_rules = []
    for rule in node.props.get("egress", []):
        egress_rules.append({
            "from_port": rule.get("from_port", 0),
            "to_port": rule.get("to_port", 0),
            "protocol": rule.get("protocol", "-1"),
            "cidr_blocks": rule.get("cidr_blocks", ["0.0.0.0/0"]),
            "description": rule.get("description", "")
        })
    
    # Default egress if none specified
    if not egress_rules:
        egress_rules.append({
            "from_port": 0,
            "to_port": 0,
            "protocol": "-1",
            "cidr_blocks": ["0.0.0.0/0"],
            "description": "Allow all outbound"
        })
    
    resources["aws_security_group"][name] = {
        "name": node.name or node.id,
        "description": node.props.get("description", f"Security group {node.name or node.id}"),
        "vpc_id": "${aws_vpc.vpc_1.id}",
        "ingress": ingress_rules,
        "egress": egress_rules,
        "tags": node.tags or {"Name": node.name or node.id}
    }


def _add_alb(resources: dict, node: BaseNode) -> None:
    """Add aws_lb, aws_lb_target_group, and aws_lb_listener resources."""
    if "aws_lb" not in resources:
        resources["aws_lb"] = {}
    if "aws_lb_target_group" not in resources:
        resources["aws_lb_target_group"] = {}
    if "aws_lb_listener" not in resources:
        resources["aws_lb_listener"] = {}
    
    name = _sanitize_name(node.id)
    
    # Get subnet references
    subnet_ids = node.props.get("subnets", [])
    subnet_refs = [f"${{aws_subnet.{_sanitize_name(s)}.id}}" for s in subnet_ids]
    
    # Get security group references
    sg_ids = node.props.get("security_groups", [])
    sg_refs = [f"${{aws_security_group.{_sanitize_name(s)}.id}}" for s in sg_ids]
    
    resources["aws_lb"][name] = {
        "name": (node.name or node.id)[:32],  # ALB name max 32 chars
        "internal": node.props.get("scheme") != "internet-facing",
        "load_balancer_type": "application",
        "security_groups": sg_refs,
        "subnets": subnet_refs,
        "tags": node.tags or {"Name": node.name or node.id}
    }
    
    # Target group
    tg_name = f"{name}_tg"
    resources["aws_lb_target_group"][tg_name] = {
        "name": f"{(node.name or node.id)[:26]}-tg",
        "port": 80,
        "protocol": "HTTP",
        "vpc_id": "${aws_vpc.vpc_1.id}",
        "health_check": {
            "path": "/",
            "healthy_threshold": 2,
            "unhealthy_threshold": 10
        }
    }
    
    # Listener
    listener_name = f"{name}_listener"
    resources["aws_lb_listener"][listener_name] = {
        "load_balancer_arn": f"${{aws_lb.{name}.arn}}",
        "port": 80,
        "protocol": "HTTP",
        "default_action": {
            "type": "forward",
            "target_group_arn": f"${{aws_lb_target_group.{tg_name}.arn}}"
        }
    }


def _add_ec2(resources: dict, node: BaseNode) -> None:
    """Add aws_instance resource."""
    if "aws_instance" not in resources:
        resources["aws_instance"] = {}
    
    name = _sanitize_name(node.id)
    
    # Get subnet reference
    subnet_id = node.props.get("subnet_id", "subnet-private-1")
    subnet_ref = f"${{aws_subnet.{_sanitize_name(subnet_id)}.id}}"
    
    # Get security group references
    sg_ids = node.props.get("security_groups", [])
    sg_refs = [f"${{aws_security_group.{_sanitize_name(s)}.id}}" for s in sg_ids]
    
    # Use Amazon Linux 2023 AMI (will be looked up via data source)
    resources["aws_instance"][name] = {
        "ami": "ami-0c7217cdde317cfec",  # Amazon Linux 2023 in us-east-1
        "instance_type": node.props.get("instance_type", "t3.micro"),
        "subnet_id": subnet_ref,
        "vpc_security_group_ids": sg_refs,
        "tags": node.tags or {"Name": node.name or node.id}
    }


def _add_rds(resources: dict, node: BaseNode, graph: TopologyGraph) -> None:
    """Add aws_db_subnet_group and aws_db_instance resources."""
    if "aws_db_subnet_group" not in resources:
        resources["aws_db_subnet_group"] = {}
    if "aws_db_instance" not in resources:
        resources["aws_db_instance"] = {}
    
    name = _sanitize_name(node.id)
    
    # Find all database subnets for the subnet group
    db_subnets = [n for n in graph.nodes if n.kind == NodeKind.SUBNET and "db" in n.id.lower()]
    if not db_subnets:
        # Fall back to private subnets
        db_subnets = [n for n in graph.nodes if n.kind == NodeKind.SUBNET and "private" in n.id.lower()]
    
    subnet_refs = [f"${{aws_subnet.{_sanitize_name(s.id)}.id}}" for s in db_subnets[:2]]
    
    # Need at least 2 subnets for RDS
    if len(subnet_refs) < 2:
        subnet_refs = subnet_refs * 2  # Duplicate if only one
    
    sg_name = f"{name}_subnet_group"
    resources["aws_db_subnet_group"][sg_name] = {
        "name": f"{(node.name or node.id)[:32]}-subnet-group",
        "subnet_ids": subnet_refs,
        "tags": {"Name": f"{node.name or node.id}-subnet-group"}
    }
    
    # Get security group references
    sg_ids = node.props.get("security_groups", [])
    sg_refs = [f"${{aws_security_group.{_sanitize_name(s)}.id}}" for s in sg_ids]
    
    resources["aws_db_instance"][name] = {
        "identifier": (node.name or node.id)[:63],
        "engine": node.props.get("engine", "postgres"),
        "engine_version": node.props.get("engine_version", "15"),
        "instance_class": node.props.get("instance_class", "db.t3.micro"),
        "allocated_storage": node.props.get("allocated_storage", 20),
        "db_name": "topnetdb",
        "username": "admin",
        "password": "CHANGE_ME_PLEASE_123!",  # Should use secrets manager in production
        "db_subnet_group_name": f"${{aws_db_subnet_group.{sg_name}.name}}",
        "vpc_security_group_ids": sg_refs,
        "skip_final_snapshot": True,
        "publicly_accessible": False,
        "tags": node.tags or {"Name": node.name or node.id}
    }


def terraform_to_json(config: dict[str, Any]) -> str:
    """Convert Terraform config dict to JSON string."""
    return json.dumps(config, indent=2)
