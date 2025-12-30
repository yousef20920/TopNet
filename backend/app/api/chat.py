# app/api/chat.py
"""API endpoints for chat/conversation with the infrastructure assistant."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.chat import (
    process_chat_message,
    get_or_create_conversation,
    clear_conversation,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class StartResponse(BaseModel):
    session_id: str
    greeting: str


class MessageRequest(BaseModel):
    session_id: str
    message: str


class MessageResponse(BaseModel):
    session_id: str
    response: str
    ready_to_generate: bool
    extracted_spec: dict | None = None


class ResetRequest(BaseModel):
    session_id: str


class ResetResponse(BaseModel):
    success: bool


@router.post("/start", response_model=StartResponse)
async def start_chat() -> StartResponse:
    """Start a new chat session."""
    conversation = get_or_create_conversation()
    
    greeting = """Hi! I'm TopNet, your cloud infrastructure assistant. 👋

I'll help you design and deploy AWS infrastructure. Just tell me what you want to build!

**Examples:**
- "I need a web app with 2 servers and a PostgreSQL database"
- "High availability setup with MySQL"
- "Simple EC2 instance for testing"

What would you like to create?"""
    
    return StartResponse(
        session_id=conversation.id,
        greeting=greeting,
    )


@router.post("/message", response_model=MessageResponse)
async def send_message(request: MessageRequest) -> MessageResponse:
    """Send a message and get AI response."""
    conversation, response, spec = process_chat_message(
        request.session_id,
        request.message,
    )
    
    return MessageResponse(
        session_id=conversation.id,
        response=response,
        ready_to_generate=conversation.ready_to_generate,
        extracted_spec=spec.model_dump() if spec else None,
    )


@router.post("/reset", response_model=ResetResponse)
async def reset_chat(request: ResetRequest) -> ResetResponse:
    """Reset/clear a chat session."""
    success = clear_conversation(request.session_id)
    return ResetResponse(success=success)


@router.get("/history/{session_id}")
async def get_history(session_id: str):
    """Get chat history for a session."""
    conversation = get_or_create_conversation(session_id)
    return {
        "session_id": conversation.id,
        "messages": [
            {"role": msg.role, "content": msg.content, "timestamp": msg.timestamp}
            for msg in conversation.messages
        ],
        "ready_to_generate": conversation.ready_to_generate,
    }
