# app/api/__init__.py
"""API routes."""

from .topologies import router as topologies_router

__all__ = ["topologies_router"]
