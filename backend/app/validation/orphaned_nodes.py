# app/validation/orphaned_nodes.py
"""Validate that all resources are properly connected to their parent resources."""

import uuid

from app.core.types import TopologyGraph, ValidationResult, Severity, NodeKind, EdgeKind


def validate_orphaned_nodes(graph: TopologyGraph) -> list[ValidationResult]:
    """
    Check for orphaned resources that aren't properly connected.
    
    Checks:
    - Subnets must be attached to a VPC
    - Compute instances must be attached to a subnet
    - Databases must be attached to a subnet
    - Security groups must be attached to a VPC
    - Gateways must be attached to a VPC
    
    Returns WARNING for each orphaned resource.
    """
    results: list[ValidationResult] = []
    
    # Build sets for quick lookup
    vpc_ids = {node.id for node in graph.nodes if node.kind == NodeKind.NETWORK}
    subnet_ids = {node.id for node in graph.nodes if node.kind == NodeKind.SUBNET}
    
    # Build a map of what each node is attached to
    attached_to: dict[str, set[str]] = {}
    for edge in graph.edges:
        if edge.kind == EdgeKind.ATTACHED_TO:
            if edge.from_node not in attached_to:
                attached_to[edge.from_node] = set()
            attached_to[edge.from_node].add(edge.to_node)
    
    for node in graph.nodes:
        node_name = node.name or node.id
        node_attachments = attached_to.get(node.id, set())
        
        # Subnets must be attached to a VPC
        if node.kind == NodeKind.SUBNET:
            if not node_attachments.intersection(vpc_ids):
                results.append(ValidationResult(
                    id=f"orphan-subnet-{uuid.uuid4().hex[:8]}",
                    severity=Severity.WARNING,
                    message=f"Subnet '{node_name}' is not attached to any VPC",
                    node_ids=[node.id],
                ))
        
        # Compute instances must be attached to a subnet
        elif node.kind == NodeKind.COMPUTE_INSTANCE:
            if not node_attachments.intersection(subnet_ids):
                results.append(ValidationResult(
                    id=f"orphan-compute-{uuid.uuid4().hex[:8]}",
                    severity=Severity.WARNING,
                    message=f"Instance '{node_name}' is not attached to any subnet",
                    node_ids=[node.id],
                ))
        
        # Databases must be attached to a subnet (or have a subnet group)
        elif node.kind == NodeKind.DATABASE:
            # Check both direct attachment and subnet_ids in props
            has_subnet = bool(node_attachments.intersection(subnet_ids))
            has_subnet_prop = bool(node.props.get("subnet_ids") or node.props.get("db_subnet_group"))
            
            if not has_subnet and not has_subnet_prop:
                results.append(ValidationResult(
                    id=f"orphan-database-{uuid.uuid4().hex[:8]}",
                    severity=Severity.WARNING,
                    message=f"Database '{node_name}' is not attached to any subnet",
                    node_ids=[node.id],
                ))
        
        # Security groups must be attached to a VPC
        elif node.kind == NodeKind.SECURITY_GROUP:
            if not node_attachments.intersection(vpc_ids):
                results.append(ValidationResult(
                    id=f"orphan-sg-{uuid.uuid4().hex[:8]}",
                    severity=Severity.WARNING,
                    message=f"Security group '{node_name}' is not attached to any VPC",
                    node_ids=[node.id],
                ))
        
        # Gateways need validation based on type
        elif node.kind == NodeKind.GATEWAY:
            gateway_type = node.props.get("gateway_type", "")
            
            # Internet Gateways (IGW) must be attached to a VPC
            if gateway_type == "internet":
                if not node_attachments.intersection(vpc_ids):
                    results.append(ValidationResult(
                        id=f"orphan-igw-{uuid.uuid4().hex[:8]}",
                        severity=Severity.WARNING,
                        message=f"Internet Gateway '{node_name}' is not attached to any VPC",
                        node_ids=[node.id],
                    ))
            
            # NAT Gateways must be attached to a subnet (or have subnet_id in props)
            elif gateway_type == "nat":
                has_subnet_edge = bool(node_attachments.intersection(subnet_ids))
                has_subnet_prop = bool(node.props.get("subnet_id"))
                
                if not has_subnet_edge and not has_subnet_prop:
                    results.append(ValidationResult(
                        id=f"orphan-nat-{uuid.uuid4().hex[:8]}",
                        severity=Severity.WARNING,
                        message=f"NAT Gateway '{node_name}' is not attached to any subnet",
                        node_ids=[node.id],
                    ))
            
            # Unknown gateway types - just check for VPC attachment
            else:
                if not node_attachments.intersection(vpc_ids):
                    results.append(ValidationResult(
                        id=f"orphan-gw-{uuid.uuid4().hex[:8]}",
                        severity=Severity.WARNING,
                        message=f"Gateway '{node_name}' is not attached to any VPC",
                        node_ids=[node.id],
                    ))
    
    return results
