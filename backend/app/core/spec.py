# app/core/spec.py
"""TopologySpec types for NL -> Graph pipeline."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ComponentRole(str, Enum):
    WEB_TIER = "web_tier"
    DB_TIER = "db_tier"
    TRAFFIC_GEN = "traffic_gen"
    NETWORKING = "networking"
    OTHER = "other"


class ComponentSpec(BaseModel):
    """Specification for a single component in the topology."""

    role: ComponentRole
    quantity: int | None = None
    description: str
    constraints: dict[str, Any] | None = None


class TopologySpec(BaseModel):
    """High-level specification parsed from natural language."""

    provider: str = Field(default="aws")
    region: str = Field(default="us-east-1")
    components: list[ComponentSpec] = Field(default_factory=list)
