# app/validation/__init__.py
"""
Validation passes module - Phase 3.

This module provides validators that analyze TopologyGraph and return
structured ValidationResult[] with warnings and errors about infrastructure issues.
"""

from app.core.types import TopologyGraph, ValidationResult

from .cidr_overlap import validate_cidr_overlap
from .orphaned_nodes import validate_orphaned_nodes
from .reachability import validate_reachability
from .ha_spof import validate_ha_spof


__all__ = [
    "validate_cidr_overlap",
    "validate_orphaned_nodes",
    "validate_reachability",
    "validate_ha_spof",
    "run_all_validations",
]


def run_all_validations(graph: TopologyGraph) -> list[ValidationResult]:
    """
    Run all validation passes on a topology graph.
    
    Returns a combined list of all validation results from:
    - CIDR overlap detection
    - Orphaned node detection
    - Reachability/security analysis
    - HA/SPOF detection
    """
    results: list[ValidationResult] = []
    
    # Run each validator
    results.extend(validate_cidr_overlap(graph))
    results.extend(validate_orphaned_nodes(graph))
    results.extend(validate_reachability(graph))
    results.extend(validate_ha_spof(graph))
    
    return results
