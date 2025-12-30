# app/validation/ha_spof.py
"""Validate high availability and detect single points of failure."""

import uuid
from collections import defaultdict

from app.core.types import TopologyGraph, ValidationResult, Severity, NodeKind


def validate_ha_spof(graph: TopologyGraph) -> list[ValidationResult]:
    """
    Check for single points of failure and high availability issues.
    
    Checks:
    - If multiple compute instances exist but all in same AZ -> WARNING
    - If database exists but not multi-AZ -> INFO
    - If NAT gateway exists in single AZ with private subnets in multiple AZs -> WARNING
    - If load balancer exists but only targets instances in one AZ -> WARNING
    
    Returns WARNING/INFO for HA issues.
    """
    results: list[ValidationResult] = []
    
    # Group resources by type and AZ
    compute_by_az: dict[str, list[str]] = defaultdict(list)
    subnets_by_az: dict[str, list[str]] = defaultdict(list)
    databases: list[tuple[str, str, bool]] = []  # (id, name, is_multi_az)
    nat_gateways: list[tuple[str, str, str | None]] = []  # (id, name, az)
    load_balancers: list[tuple[str, str]] = []  # (id, name)
    
    for node in graph.nodes:
        node_name = node.name or node.id
        az = node.az
        
        if node.kind == NodeKind.COMPUTE_INSTANCE:
            az_key = az or "unknown"
            compute_by_az[az_key].append(node.id)
        
        elif node.kind == NodeKind.SUBNET:
            az_key = az or "unknown"
            subnets_by_az[az_key].append(node.id)
        
        elif node.kind == NodeKind.DATABASE:
            is_multi_az = node.props.get("multi_az", False)
            databases.append((node.id, node_name, is_multi_az))
        
        elif node.kind == NodeKind.GATEWAY:
            gateway_type = node.props.get("gateway_type", "")
            if gateway_type == "nat":
                nat_gateways.append((node.id, node_name, az))
        
        elif node.kind == NodeKind.LOAD_BALANCER:
            load_balancers.append((node.id, node_name))
    
    # Check: Multiple compute instances in single AZ
    total_compute = sum(len(instances) for instances in compute_by_az.values())
    if total_compute > 1 and len(compute_by_az) == 1:
        az_name = list(compute_by_az.keys())[0]
        instance_ids = list(compute_by_az.values())[0]
        results.append(ValidationResult(
            id=f"ha-single-az-compute-{uuid.uuid4().hex[:8]}",
            severity=Severity.WARNING,
            message=f"All {total_compute} compute instances are in a single AZ ({az_name}). Consider distributing across AZs for high availability.",
            node_ids=instance_ids,
        ))
    
    # Check: Database without multi-AZ
    for db_id, db_name, is_multi_az in databases:
        if not is_multi_az:
            results.append(ValidationResult(
                id=f"ha-db-single-az-{uuid.uuid4().hex[:8]}",
                severity=Severity.INFO,
                message=f"Database '{db_name}' is not configured for Multi-AZ. Consider enabling for production workloads.",
                node_ids=[db_id],
            ))
    
    # Check: NAT gateway in single AZ with subnets in multiple AZs
    if nat_gateways and len(subnets_by_az) > 1:
        if len(nat_gateways) == 1:
            nat_id, nat_name, nat_az = nat_gateways[0]
            subnet_azs = list(subnets_by_az.keys())
            results.append(ValidationResult(
                id=f"ha-single-nat-{uuid.uuid4().hex[:8]}",
                severity=Severity.WARNING,
                message=f"Single NAT Gateway '{nat_name}' in {nat_az or 'unknown AZ'}, but subnets span {len(subnet_azs)} AZs. If this NAT fails, private subnets in other AZs lose internet access.",
                node_ids=[nat_id],
            ))
    
    # Check: Load balancer with targets in single AZ
    # This is a bit tricky - we'd need to trace LB -> target group -> instances
    # For MVP, just check if LB exists and compute is in single AZ
    if load_balancers and total_compute > 1 and len(compute_by_az) == 1:
        for lb_id, lb_name in load_balancers:
            results.append(ValidationResult(
                id=f"ha-lb-single-az-{uuid.uuid4().hex[:8]}",
                severity=Severity.WARNING,
                message=f"Load balancer '{lb_name}' exists but all target instances are in a single AZ. This defeats the purpose of load balancing for HA.",
                node_ids=[lb_id] + list(compute_by_az.values())[0],
            ))
    
    return results
