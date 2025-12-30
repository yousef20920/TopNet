# app/validation/cidr_overlap.py
"""Validate that subnet CIDR blocks within the same VPC do not overlap."""

import uuid
from ipaddress import ip_network, IPv4Network

from app.core.types import TopologyGraph, ValidationResult, Severity, NodeKind, EdgeKind


def validate_cidr_overlap(graph: TopologyGraph) -> list[ValidationResult]:
    """
    Check for overlapping CIDR blocks among subnets attached to the same VPC.
    
    Returns ERROR for each pair of overlapping subnets.
    """
    results: list[ValidationResult] = []
    
    # Build a map: vpc_id -> list of (subnet_id, subnet_name, cidr)
    vpc_subnets: dict[str, list[tuple[str, str, str]]] = {}
    
    # First, find all VPCs
    vpc_ids = {node.id for node in graph.nodes if node.kind == NodeKind.NETWORK}
    
    # For each VPC, initialize empty list
    for vpc_id in vpc_ids:
        vpc_subnets[vpc_id] = []
    
    # Find all subnets and which VPC they're attached to
    for node in graph.nodes:
        if node.kind != NodeKind.SUBNET:
            continue
        
        subnet_id = node.id
        subnet_name = node.name or subnet_id
        cidr = node.props.get("cidr_block", "")
        
        if not cidr:
            continue
        
        # Find which VPC this subnet is attached to
        for edge in graph.edges:
            if (edge.kind == EdgeKind.ATTACHED_TO and 
                edge.from_node == subnet_id and 
                edge.to_node in vpc_ids):
                vpc_subnets[edge.to_node].append((subnet_id, subnet_name, cidr))
                break
    
    # Check for overlaps within each VPC
    for vpc_id, subnets in vpc_subnets.items():
        if len(subnets) < 2:
            continue
        
        # Parse all CIDRs
        parsed: list[tuple[str, str, IPv4Network]] = []
        for subnet_id, subnet_name, cidr in subnets:
            try:
                network = ip_network(cidr, strict=False)
                parsed.append((subnet_id, subnet_name, network))
            except ValueError:
                results.append(ValidationResult(
                    id=f"cidr-invalid-{uuid.uuid4().hex[:8]}",
                    severity=Severity.ERROR,
                    message=f"Invalid CIDR block '{cidr}' in subnet '{subnet_name}'",
                    node_ids=[subnet_id],
                ))
        
        # Check each pair for overlap
        checked_pairs: set[tuple[str, str]] = set()
        for i, (id1, name1, net1) in enumerate(parsed):
            for j, (id2, name2, net2) in enumerate(parsed):
                if i >= j:
                    continue
                
                pair_key = tuple(sorted([id1, id2]))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)
                
                if net1.overlaps(net2):
                    results.append(ValidationResult(
                        id=f"cidr-overlap-{uuid.uuid4().hex[:8]}",
                        severity=Severity.ERROR,
                        message=f"CIDR overlap: '{name1}' ({net1}) overlaps with '{name2}' ({net2})",
                        node_ids=[id1, id2],
                    ))
    
    return results
