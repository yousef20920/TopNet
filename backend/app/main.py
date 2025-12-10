# app/main.py
"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import topologies_router
from app.api.deploy import router as deploy_router

app = FastAPI(
    title="TopNet API",
    description="Natural-Language Cloud Network Topology Copilot",
    version="0.1.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(topologies_router)
app.include_router(deploy_router)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    from datetime import datetime, timezone

    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=3001, reload=True)
