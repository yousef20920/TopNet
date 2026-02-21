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


SYSTEM_PROMPT = """You are TopNet, an AI assistant that helps users design cloud infrastructure on AWS. Your job is to have a CONVERSATION with the user to understand what they want to build, then generate a topology specification.

🚨 CRITICAL RULES - READ CAREFULLY:

1. **ALWAYS ASK QUESTIONS FIRST** - Never generate infrastructure on the first message! Always ask 2-3 clarifying questions.
2. **LISTEN FIRST**: Carefully read what the user already told you. DON'T ask questions about things they already stated clearly.
3. **ACKNOWLEDGE**: Start by acknowledging what you understood from their message
4. **ASK SMART QUESTIONS**: Only ask about missing information, not things they already mentioned
5. Be concise and friendly
6. **EXPLAIN INFRASTRUCTURE**: When a user asks for "a server", explain that AWS requires basic networking:
   - Simple setup (1 server, no DB): "I'll create a minimal setup: VPC (network), subnet, security group (firewall), and your EC2 instance - about 6 resources total. This is the minimum AWS needs for a server."
   - Production setup: Mention VPC, subnets, load balancer, etc.
7. **ONLY GENERATE AFTER USER CONFIRMS** - Wait for user to answer your questions OR say "yes, generate it"
8. When ready to generate, include a JSON spec block in your response
9. NEVER put comments in the JSON - it must be valid JSON
10. Use "web_tier" role for EC2 instances (web servers, app servers, test instances, API servers)

📋 INFORMATION TO GATHER (only ask if NOT already mentioned):
- Application type (web app, API, data processing) - If they said "web application", DON'T ask this
- Database needs - Do they need one? What type? (PostgreSQL, MySQL, or none)
- High availability - Multiple AZs? Load balancer? - If they said "highly available", you know the answer
- Instance count - How many servers? (default: 1 if not specified)
- Region preference (default: us-east-2 Ohio if not specified)
  - IMPORTANT: Ohio = us-east-2, Virginia = us-east-1
- Instance sizes (default: t3.micro for EC2, db.t2.micro for RDS if not specified)

🎯 CONVERSATION FLOW:
1. First message from user → Ask 2-3 clarifying questions, DON'T generate yet
2. User answers questions → Ask if they want you to generate, OR if they say "yes/sounds good/let's do it" then generate
3. Generate topology with JSON spec

✅ EXAMPLE OF GOOD CONVERSATION FLOW:

**Turn 1:**
User: "I need a web application with a database"
You: "Got it! I'll help you set up a web application with a database.

Quick questions to make sure I get this right:
- What database engine do you prefer? (PostgreSQL or MySQL?)
- How many web servers do you need? (I can start with 1 for simplicity)
- Any specific AWS region? (I'll default to us-east-2 Ohio, which is cost-effective)

Once you confirm, I'll generate the infrastructure design!"

**Turn 2:**
User: "PostgreSQL, 1 server is fine, use Ohio"
You: "Perfect! Here's what I'll create for you:

📦 Infrastructure Summary:
• 1 EC2 web server (t3.micro) in Ohio
• 1 RDS PostgreSQL database (db.t2.micro)
• VPC with public subnet and security groups
• ~$21/month estimated cost

This is a TIER 1 setup - optimized for hobby/MVP projects (single AZ, no load balancer).

[Generates JSON spec here]"

❌ EXAMPLE OF BAD RESPONSE (DON'T DO THIS):
User: "I need a web application with a database"
You: "Here's what I'll create: [generates JSON immediately]"  ← WRONG! Ask questions first!

❌ ANOTHER BAD EXAMPLE:
User: "I need a highly available web application with load balancer"
You: "Is this a web application, API, or something else?"  ← WRONG! They already said "web application"!

🔧 WHEN TO GENERATE (ONLY after user answers your questions OR confirms):

When the user has answered your questions and confirmed they want to proceed, include this VALID JSON block (no comments!) in your response:

```json
{
  "ready": true,
  "spec": {
    "provider": "aws",
    "region": "us-east-2",
    "components": [
      {
        "role": "web_tier",
        "quantity": 1,
        "description": "Web servers for hosting the application",
        "constraints": {"instance_type": "t3.micro"}
      },
      {
        "role": "db_tier",
        "quantity": 1,
        "description": "PostgreSQL database",
        "constraints": {"engine": "postgres", "instance_class": "db.t2.micro"}
      }
    ]
  }
}
```

📝 Valid Configuration Options:
- Roles: "web_tier" (for EC2/compute), "db_tier" (for RDS/database)
- Database engines: "postgres", "mysql"
- EC2 instances: "t3.micro", "t3.small", "t3.medium"
- RDS instances: "db.t2.micro" (free tier), "db.t3.micro", "db.t3.small"

⚠️ IMPORTANT REMINDERS:
1. NEVER generate JSON on the first message - ALWAYS ask questions first
2. Only include JSON after user confirms or answers your questions
3. If unsure, ask more questions rather than generating with defaults
4. Always explain what you're about to create before generating
5. Mention the cost estimate and tier level (TIER 1 vs TIER 2)"""


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

        # Use Amazon Nova
        model_id = "amazon.nova-micro-v1:0"

        try:
            print(f"[chat] Calling model: {model_id}")
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
            print(f"[chat] Model {model_id} failed: {e}")
            raise

    except Exception as e:
        import traceback
        print(f"[chat] Bedrock chat failed: {e}")
        print(f"[chat] Traceback: {traceback.format_exc()}")
        # Fall back to rule-based response
        return generate_fallback_response(conversation, user_message)


def chat_with_llm(conversation: ConversationState, user_message: str) -> str:
    """Send message to LLM and get response. Tries AWS Bedrock, then rule-based fallback."""

    # Try AWS Bedrock first (uses AWS credentials from env)
    if os.environ.get('AWS_ACCESS_KEY_ID') or os.environ.get('AWS_PROFILE'):
        print("[chat] Using AWS Bedrock Nova")
        return chat_with_bedrock(conversation, user_message)

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

    # Check for infrastructure keywords in ENTIRE conversation (not just current message)
    # This ensures we remember what user mentioned earlier
    all_user_messages = " ".join([msg.content.lower() for msg in conversation.messages if msg.role == "user"])
    has_web = any(kw in all_user_messages for kw in ["web", "server", "ec2", "instance", "api", "backend", "app"])
    has_db = any(kw in all_user_messages for kw in ["database", "db", "rds", "postgres", "mysql", "sql"])
    has_ha = any(kw in all_user_messages for kw in ["ha", "high availability", "redundant", "multiple", "2", "3", "two", "three"])

    # Check for confirmation keywords
    has_confirmation = any(kw in msg_lower for kw in ["yes", "confirm", "sounds good", "looks good", "let's do it", "go ahead", "proceed", "generate", "create it"])

    # On first turn, always ask questions (unless they're confirming)
    if msg_count <= 2 and not has_confirmation:
        # Ask clarifying questions
        response_parts = ["Got it! I'll help you set up "]

        if has_web and has_db:
            response_parts.append("a web application with a database.\n\n")
        elif has_web:
            response_parts.append("a web server.\n\n")
        elif has_db:
            response_parts.append("a database.\n\n")
        else:
            response_parts.append("your infrastructure.\n\n")

        response_parts.append("Quick questions to make sure I get this right:\n\n")

        questions = []

        # Ask about database if mentioned but not specific (check entire conversation)
        if has_db and not ("postgres" in all_user_messages or "mysql" in all_user_messages):
            questions.append("- What database engine? (PostgreSQL or MySQL?)")

        # Ask about quantity if not specified (check entire conversation)
        if has_web and not has_ha and not re.search(r'\d+\s*(?:server|instance)', all_user_messages):
            questions.append("- How many web servers? (I can start with 1 for simplicity)")

        # Ask about region if not mentioned (check entire conversation)
        if not any(r in all_user_messages for r in ["region", "ohio", "virginia", "west", "europe"]):
            questions.append("- Any AWS region preference? (I'll default to us-east-2 Ohio)")

        # Always ask at least one question
        if not questions:
            questions.append("- Should I proceed with the defaults? (t3.micro instances, us-east-2 region)")

        response_parts.append("\n".join(questions))
        response_parts.append("\n\nOnce you confirm, I'll generate the infrastructure design!")

        return "".join(response_parts)

    # If user is confirming or answering questions, proceed with generation
    # Extract numbers (check entire conversation)
    quantity = 1
    num_match = re.search(r'(\d+)\s*(?:server|instance|ec2)', all_user_messages)
    if num_match:
        quantity = int(num_match.group(1))
    elif has_ha:
        quantity = 2

    # Detect region (check entire conversation)
    region = "us-east-2"
    if "ohio" in all_user_messages:
        region = "us-east-2"
    elif "west" in all_user_messages:
        region = "us-west-2"
    elif "europe" in all_user_messages or "eu" in all_user_messages:
        region = "eu-west-1"

    # Detect instance type (check current message only - user likely specifying size in follow-up)
    instance_type = "t3.micro"
    if "large" in msg_lower:
        instance_type = "t3.large"
    elif "medium" in msg_lower:
        instance_type = "t3.medium"

    # Detect DB engine (check entire conversation - user mentioned this earlier)
    db_engine = "postgres"
    if "mysql" in all_user_messages:
        db_engine = "mysql"
    elif "postgres" in all_user_messages:
        db_engine = "postgres"

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

        # Build response - acknowledge what they said
        response_parts = ["Perfect! I understand you need:\n"]

        # List what we understood from their message
        understood = []
        if has_web:
            if has_ha:
                understood.append(f"✓ Highly available web application ({quantity} instances)")
            else:
                understood.append(f"✓ Web application ({quantity} instance{'s' if quantity > 1 else ''})")
        if "load balancer" in msg_lower or "lb" in msg_lower:
            understood.append("✓ Load balancer")
        if "auto" in msg_lower and "scal" in msg_lower:
            understood.append("✓ Auto-scaling capability")
        if has_db:
            understood.append(f"✓ {db_engine.upper()} database")

        if understood:
            response_parts.append("\n".join(understood))
            response_parts.append("\n\nHere's what I'll create:\n")
        
        if has_web and not has_db and quantity == 1:
            # Simple mode - explain the minimal infrastructure
            response_parts.append(f"**Simple Setup** (minimal AWS infrastructure):")
            response_parts.append(f"- 1 EC2 instance ({instance_type}) for your server")
            response_parts.append(f"- VPC (virtual network)")
            response_parts.append(f"- Subnet (network segment)")
            response_parts.append(f"- Security group (firewall rules)")
            response_parts.append(f"- Internet gateway + route table")
            response_parts.append(f"\n_Total: ~6 resources. This is the minimum AWS needs to run a server._")
        else:
            # Production mode - list main components
            if has_web:
                response_parts.append(f"- **{quantity} EC2 instance(s)** ({instance_type}) for your web/app tier")
            if has_db:
                response_parts.append(f"- **RDS {db_engine.upper()}** database")
            response_parts.append(f"- **Networking**: VPC, subnets across 2 AZs, load balancer, NAT gateway, security groups, route tables")

        response_parts.append(f"\n**Region:** {region}")

        # Only ask clarifying questions if we're missing key info (check entire conversation)
        clarifying_questions = []
        if not has_db:
            clarifying_questions.append("- Do you need a database? (PostgreSQL/MySQL, or no database)")
        if "region" not in all_user_messages and "ohio" not in all_user_messages and region == "us-east-2":
            clarifying_questions.append(f"- Region preference? (I'll use {region} by default)")

        if clarifying_questions:
            response_parts.append("\n\n**Quick question:**")
            response_parts.extend(clarifying_questions)
            response_parts.append("\nOr if this looks good, click **Generate Topology** below!")
        else:
            response_parts.append("\nDoes this look good? Click **Generate Topology** below!")

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
