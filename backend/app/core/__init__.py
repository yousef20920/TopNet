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
    "TopologyGraph",
    "TopologySpec",
    "ValidationResult",
]
