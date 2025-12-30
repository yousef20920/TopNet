# app/core/__init__.py
"""Core types and data structures."""

from .spec import ComponentRole, ComponentSpec, TopologySpec
from .types import (
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
from .builder import TopologyBuilder, build_topology_from_spec
from .nlp import parse_nl_to_spec, parse_nl_to_spec_rules

__all__ = [
    "BaseNode",
    "ComponentRole",
    "ComponentSpec",
    "Edge",
    "EdgeKind",
    "NodeKind",
    "Provider",
    "Severity",
    "TerraformFile",
    "TopologyBuilder",
    "TopologyGraph",
    "TopologySpec",
    "ValidationResult",
    "build_topology_from_spec",
    "parse_nl_to_spec",
    "parse_nl_to_spec_rules",
]
