# app/core/chat.py
"""Chat/conversation manager for infrastructure planning."""

import json
import os
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from app.core.spec import ComponentRole, ComponentSpec, TopologySpec


class ChatMessage(BaseModel):
    """A single message in the conversation."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    role: str  # "user" or "assistant"
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ConversationState(BaseModel):
    """Tracks the state of a conversation."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    messages: list[ChatMessage] = Field(default_factory=list)
    spec: TopologySpec | None = None
    ready_to_generate: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# In-memory conversation store (in production, use a database)
conversations: dict[str, ConversationState] = {}


SYSTEM_PROMPT = """You are TopNet, an AI assistant that helps users design cloud infrastructure on AWS. Your job is to have a conversation with the user to understand what they want to build, then generate a topology specification.

IMPORTANT RULES:
1. Ask clarifying questions to understand the user's needs
2. Be concise and friendly
3. When you have enough information, include a JSON spec block in your response
4. Only include the JSON when you're confident you understand what the user wants
5. NEVER put comments in the JSON - it must be valid JSON
6. Use "web_tier" role for EC2 instances (web servers, app servers, test instances)

Questions to consider asking:
- What type of application? (web app, API, data processing, etc.)
- Do they need a database? What type? (PostgreSQL, MySQL)
- How many servers/instances?
- Do they need high availability (multiple AZs)?
- What region? (default: us-east-2 Ohio)
  - IMPORTANT: Ohio = us-east-2, Virginia = us-east-1
- Any specific instance sizes? (default: t3.micro)

When ready to generate, include this VALID JSON block (no comments!) in your response:
```json
{
  "ready": true,
  "spec": {
    "provider": "aws",
    \"region\": \"us-east-2\",
    "components": [
      {
        "role": "web_tier",
        "quantity": 2,
        "description": "Web servers",
        "constraints": {"instance_type": "t3.micro"}
      },
      {
        "role": "db_tier",
        "quantity": 1,
        "description": "PostgreSQL database",
        "constraints": {"engine": "postgres", "instance_class": "db.t3.micro"}
      }
    ]
  }
}
```

Valid roles: "web_tier" (for EC2/compute), "db_tier" (for RDS), "networking", "other"
Valid engines: "postgres", "mysql"

Remember: Only include the JSON when you have gathered enough information. Otherwise, just chat normally and ask questions."""


def get_or_create_conversation(conversation_id: str | None = None) -> ConversationState:
    """Get existing conversation or create a new one."""
    if conversation_id and conversation_id in conversations:
        return conversations[conversation_id]
    
    conv = ConversationState()
    conversations[conv.id] = conv
    return conv


def chat_with_bedrock(conversation: ConversationState, user_message: str) -> str:
    """Send message to AWS Bedrock and get response."""
    import boto3

    try:
        # Create Bedrock runtime client
        bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
        )

        # Build messages - content must be list of objects
        messages = []
        for msg in conversation.messages:
            messages.append({
                "role": msg.role, 
                "content": [{"text": msg.content}]
            })
        messages.append({
            "role": "user", 
            "content": [{"text": user_message}]
        })

        # Try models in order - Nova doesn't need approval, Claude does
        models_to_try = [
            "amazon.nova-micro-v1:0",                   # Amazon Nova Lite (no approval needed)
            "anthropic.claude-3-haiku-20240307-v1:0",  # Claude Haiku (needs use case form)
        ]
        
        last_error = None
        for model_id in models_to_try:
            try:
                print(f"[chat] Trying model: {model_id}")
                response = bedrock.converse(
                    modelId=model_id,
                    messages=messages,
                    system=[{"text": SYSTEM_PROMPT}],
                    inferenceConfig={
                        "maxTokens": 1000,
                        "temperature": 0.7,
                    }
                )
                print(f"[chat] Success with model: {model_id}")
                return response['output']['message']['content'][0]['text']
            except Exception as e:
                last_error = e
                print(f"[chat] Model {model_id} failed: {e}")
                continue
        
        # All models failed
        raise last_error

    except Exception as e:
        import traceback
        print(f"[chat] Bedrock chat failed: {e}")
        print(f"[chat] Traceback: {traceback.format_exc()}")
        # Fall back to rule-based response
        return generate_fallback_response(conversation, user_message)


def chat_with_llm(conversation: ConversationState, user_message: str, api_key: str | None = None) -> str:
    """Send message to LLM and get response. Tries Bedrock first, then OpenAI, then fallback."""
    
    # Try AWS Bedrock first (uses AWS credentials from env)
    if os.environ.get('AWS_ACCESS_KEY_ID') or os.environ.get('AWS_PROFILE'):
        print("[chat] Using AWS Bedrock (Claude)")
        return chat_with_bedrock(conversation, user_message)
    
    # Try OpenAI if configured
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if api_key:
        print("[chat] Using OpenAI")
        import httpx
        
        # Build messages for LLM
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in conversation.messages:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        try:
            response = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1000,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"OpenAI chat failed: {e}")
    
    # Fall back to rule-based response
    print("[chat] Using rule-based fallback")
    return generate_fallback_response(conversation, user_message)


def generate_fallback_response(conversation: ConversationState, user_message: str) -> str:
    """Generate a response without LLM using rules."""
    msg_lower = user_message.lower().strip()
    msg_count = len(conversation.messages)
    
    # Greetings
    greetings = ["hi", "hello", "hey", "help", "start"]
    if msg_lower in greetings or msg_count == 0:
        return """Hi! I'm TopNet, your cloud infrastructure assistant. 👋

I'll help you design your AWS infrastructure. Let me ask a few questions:

**What would you like to build?**
- A web application with a database?
- Just some EC2 instances?
- A complete 3-tier architecture?

Just describe what you need, and I'll help you configure it!"""

    # Check for infrastructure keywords
    has_web = any(kw in msg_lower for kw in ["web", "server", "ec2", "instance", "api", "backend", "app"])
    has_db = any(kw in msg_lower for kw in ["database", "db", "rds", "postgres", "mysql", "sql"])
    has_ha = any(kw in msg_lower for kw in ["ha", "high availability", "redundant", "multiple", "2", "3", "two", "three"])
    
    # Extract numbers
    quantity = 1
    num_match = re.search(r'(\d+)\s*(?:server|instance|ec2)', msg_lower)
    if num_match:
        quantity = int(num_match.group(1))
    elif has_ha:
        quantity = 2
    
    # Detect region
    region = "us-east-2"
    if "west" in msg_lower:
        region = "us-west-2"
    elif "europe" in msg_lower or "eu" in msg_lower:
        region = "eu-west-1"
    
    # Detect instance type
    instance_type = "t3.micro"
    if "large" in msg_lower:
        instance_type = "t3.large"
    elif "medium" in msg_lower:
        instance_type = "t3.medium"
    
    # Detect DB engine
    db_engine = "postgres"
    if "mysql" in msg_lower:
        db_engine = "mysql"
    
    # If we have enough info, generate the spec
    if has_web or has_db:
        components = []
        
        if has_web:
            components.append({
                "role": "web_tier",
                "quantity": quantity,
                "description": f"{quantity} web server(s)",
                "constraints": {"instance_type": instance_type}
            })
        
        if has_db:
            components.append({
                "role": "db_tier",
                "quantity": 1,
                "description": f"{db_engine.upper()} database",
                "constraints": {"engine": db_engine, "instance_class": "db.t3.micro"}
            })
        
        spec_json = json.dumps({
            "ready": True,
            "spec": {
                "provider": "aws",
                "region": region,
                "components": components
            }
        }, indent=2)
        
        # Build response
        response_parts = ["Great! Based on what you've told me, here's what I'll create:\n"]
        
        if has_web:
            response_parts.append(f"- **{quantity} EC2 instance(s)** ({instance_type}) for your web/app tier")
        if has_db:
            response_parts.append(f"- **RDS {db_engine.upper()}** database")
        
        response_parts.append(f"- **Region:** {region}")
        response_parts.append(f"- Plus: VPC, subnets, security groups, load balancer, route tables")
        response_parts.append("\nDoes this look good? If yes, click **Generate Topology** below!")
        response_parts.append(f"\n```json\n{spec_json}\n```")
        
        return "\n".join(response_parts)
    
    # Need more info - ask follow-up questions
    if msg_count < 2:
        return """I'd love to help! Could you tell me more about what you're building?

For example:
- "I need a web app with 2 servers and a PostgreSQL database"
- "Just a simple EC2 instance for testing"
- "High availability setup with MySQL in eu-west-1"

What's your use case?"""
    
    if not has_web and not has_db:
        return """I'm not quite sure what infrastructure you need. Could you clarify?

**Do you need:**
1. **Web servers** (EC2 instances)?
2. **A database** (RDS PostgreSQL or MySQL)?
3. **Both** (typical web application setup)?

Just let me know and I'll configure it for you!"""
    
    return """Got it! Let me make sure I understand. Could you confirm:

1. **How many servers** do you need? (1, 2, 3...?)
2. **What region?** (us-east-1, us-west-2, eu-west-1...?)
3. **Any specific requirements?** (instance size, database type, etc.)"""


def process_chat_message(
    conversation_id: str | None,
    user_message: str,
) -> tuple[ConversationState, str, TopologySpec | None]:
    """Process a chat message and return updated conversation, response, and optional spec."""
    
    # Get or create conversation
    conversation = get_or_create_conversation(conversation_id)
    
    # Add user message
    conversation.messages.append(ChatMessage(role="user", content=user_message))
    
    # Get AI response
    ai_response = chat_with_llm(conversation, user_message)
    
    # Add AI response
    conversation.messages.append(ChatMessage(role="assistant", content=ai_response))
    
    # Check if response contains a spec
    spec = extract_spec_from_response(ai_response)
    if spec:
        conversation.spec = spec
        conversation.ready_to_generate = True
    
    # Save conversation
    conversations[conversation.id] = conversation
    
    return conversation, ai_response, spec


def extract_spec_from_response(response: str) -> TopologySpec | None:
    """Extract TopologySpec from AI response if present."""
    # Look for JSON block
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response)
    if not json_match:
        return None
    
    try:
        json_str = json_match.group(1)
        # Remove JavaScript-style comments that LLMs sometimes add
        json_str = re.sub(r'//.*?$', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'/\*.*?\*/', '', json_str, flags=re.DOTALL)
        
        data = json.loads(json_str)
        
        if not data.get("ready"):
            return None
        
        spec_data = data.get("spec", {})
        components = []
        
        for comp in spec_data.get("components", []):
            role_str = comp.get("role", "other")
            try:
                role = ComponentRole(role_str)
            except ValueError:
                role = ComponentRole.OTHER
            
            components.append(
                ComponentSpec(
                    role=role,
                    quantity=comp.get("quantity"),
                    description=comp.get("description", ""),
                    constraints=comp.get("constraints"),
                )
            )
        
        return TopologySpec(
            provider=spec_data.get("provider", "aws"),
            region=spec_data.get("region", "us-east-2"),
            components=components,
        )
    
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"Failed to extract spec: {e}")
        return None


def clear_conversation(conversation_id: str) -> bool:
    """Clear a conversation from memory."""
    if conversation_id in conversations:
        del conversations[conversation_id]
        return True
    return False
