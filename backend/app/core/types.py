# app/core/types.py
"""Core data structures for the TopologyGraph Intermediate Representation."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Provider(str, Enum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"
    GENERIC = "generic"


class NodeKind(str, Enum):
    NETWORK = "network"  # VPC / VNet / VPC Network
    SUBNET = "subnet"
    SECURITY_GROUP = "security_group"
    LOAD_BALANCER = "load_balancer"
    COMPUTE_INSTANCE = "compute_instance"
    DATABASE = "database"
    GATEWAY = "gateway"  # IGW, NAT
    TRAFFIC_GENERATOR = "traffic_generator"
    ROUTE_TABLE = "route_table"


class EdgeKind(str, Enum):
    ATTACHED_TO = "attached_to"  # subnet -> vpc
    ROUTES_TO = "routes_to"  # route_table -> gateway/subnet
    ALLOWED_TRAFFIC = "allowed_traffic"  # sg -> sg or sg -> subnet
    PROTECTED_BY = "protected_by"  # instance -> security_group
    DEPENDS_ON = "depends_on"
    CONTAINS = "contains"


class BaseNode(BaseModel):
    """A node in the topology graph."""

    id: str
    kind: NodeKind
    name: str | None = None
    provider: Provider | None = None
    region: str | None = None
    az: str | None = None
    tags: dict[str, str] | None = None
    props: dict[str, Any] = Field(default_factory=dict)


class Edge(BaseModel):
    """An edge connecting two nodes in the topology graph."""

    id: str
    kind: EdgeKind
    from_node: str = Field(alias="from")  # 'from' is reserved in Python
    to_node: str = Field(alias="to")
    props: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class TopologyGraph(BaseModel):
    """The complete topology graph with nodes and edges."""

    id: str
    name: str | None = None
    nodes: list[BaseNode] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    metadata: dict[str, Any] | None = None


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class ValidationResult(BaseModel):
    """Result of a validation check."""

    id: str
    severity: Severity
    message: str
    node_ids: list[str] | None = Field(default=None, alias="nodeIds")

    model_config = {"populate_by_name": True}


class TerraformFile(BaseModel):
    """A generated Terraform file."""

    filename: str
    content: str
