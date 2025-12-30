# app/validation/reachability.py
"""Validate security group rules for proper isolation and security best practices."""

import uuid

from app.core.types import TopologyGraph, ValidationResult, Severity, NodeKind, EdgeKind


# Ports that are risky to expose to the internet
SENSITIVE_PORTS = {
    22: "SSH",
    3389: "RDP",
    3306: "MySQL",
    5432: "PostgreSQL",
    27017: "MongoDB",
    6379: "Redis",
    11211: "Memcached",
}

# CIDR that means "open to the world"
OPEN_CIDR = "0.0.0.0/0"


def validate_reachability(graph: TopologyGraph) -> list[ValidationResult]:
    """
    Check security group rules for potential security issues.
    
    Checks:
    - Database nodes should NOT have ingress from 0.0.0.0/0
    - SSH (port 22) open to 0.0.0.0/0 is a warning
    - Other sensitive ports open to the internet
    
    Returns WARNING/ERROR for security issues.
    """
    results: list[ValidationResult] = []
    
    # Build a map of nodes by ID for quick lookup
    nodes_by_id = {node.id: node for node in graph.nodes}
    
    # Find all security groups and their associations
    for node in graph.nodes:
        if node.kind != NodeKind.SECURITY_GROUP:
            continue
        
        sg_id = node.id
        sg_name = node.name or sg_id
        ingress_rules = node.props.get("ingress", [])
        
        # Find what resources use this security group
        protected_nodes: list[str] = []
        for edge in graph.edges:
            if edge.kind == EdgeKind.PROTECTED_BY and edge.to_node == sg_id:
                protected_nodes.append(edge.from_node)
        
        # Also check props for security_groups references
        for other_node in graph.nodes:
            sg_refs = other_node.props.get("security_groups", [])
            if sg_id in sg_refs or sg_name in sg_refs:
                if other_node.id not in protected_nodes:
                    protected_nodes.append(other_node.id)
        
        # Check if any protected node is a database
        protects_database = any(
            nodes_by_id.get(nid) and nodes_by_id[nid].kind == NodeKind.DATABASE
            for nid in protected_nodes
        )
        
        # Analyze ingress rules
        for rule in ingress_rules:
            from_port = rule.get("from_port", 0)
            to_port = rule.get("to_port", 0)
            cidr_blocks = rule.get("cidr_blocks", [])
            
            # Check if open to the world
            is_open = OPEN_CIDR in cidr_blocks
            
            if not is_open:
                continue
            
            # ERROR: Database SG open to internet on any port
            if protects_database:
                db_names = [
                    nodes_by_id[nid].name or nid 
                    for nid in protected_nodes 
                    if nodes_by_id.get(nid) and nodes_by_id[nid].kind == NodeKind.DATABASE
                ]
                results.append(ValidationResult(
                    id=f"security-db-open-{uuid.uuid4().hex[:8]}",
                    severity=Severity.ERROR,
                    message=f"Security group '{sg_name}' allows internet access to database(s): {', '.join(db_names)}",
                    node_ids=[sg_id] + protected_nodes,
                ))
            
            # Check sensitive ports
            for port, service in SENSITIVE_PORTS.items():
                if from_port <= port <= to_port:
                    # SSH is a warning (common but risky)
                    if port == 22:
                        results.append(ValidationResult(
                            id=f"security-ssh-open-{uuid.uuid4().hex[:8]}",
                            severity=Severity.WARNING,
                            message=f"Security group '{sg_name}' allows SSH (22) from 0.0.0.0/0 - consider restricting to known IPs",
                            node_ids=[sg_id],
                        ))
                    # Database ports are errors
                    elif port in [3306, 5432, 27017, 6379, 11211]:
                        results.append(ValidationResult(
                            id=f"security-dbport-open-{uuid.uuid4().hex[:8]}",
                            severity=Severity.ERROR,
                            message=f"Security group '{sg_name}' exposes {service} (port {port}) to the internet",
                            node_ids=[sg_id],
                        ))
                    # Other sensitive ports are warnings
                    else:
                        results.append(ValidationResult(
                            id=f"security-port-open-{uuid.uuid4().hex[:8]}",
                            severity=Severity.WARNING,
                            message=f"Security group '{sg_name}' exposes {service} (port {port}) to 0.0.0.0/0",
                            node_ids=[sg_id],
                        ))
    
    return results
