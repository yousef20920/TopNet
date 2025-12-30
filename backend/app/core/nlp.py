# app/core/nlp.py
"""Natural Language to TopologySpec parser using LLM."""

import json
import os
import re
from typing import Any

from app.core.spec import ComponentRole, ComponentSpec, TopologySpec


# System prompt for the LLM
SYSTEM_PROMPT = """You are a cloud infrastructure expert. Given a natural language description of cloud infrastructure, extract the components and return a JSON specification.

Output ONLY valid JSON with this structure:
{
  "provider": "aws",
  "region": "us-east-1",
  "components": [
    {
      "role": "web_tier|db_tier|traffic_gen|networking|other",
      "quantity": number or null,
      "description": "description of this component",
      "constraints": {
        // optional key-value pairs like:
        // "instance_type": "t3.medium",
        // "engine": "postgres",
        // "engine_version": "15.4",
        // "allocated_storage": 100
      }
    }
  ]
}

Rules:
1. "web_tier" = web servers, application servers, EC2 instances serving traffic
2. "db_tier" = databases (RDS, PostgreSQL, MySQL)
3. "traffic_gen" = load testing, traffic generation (not implemented yet)
4. "networking" = VPCs, subnets, gateways (usually inferred automatically)
5. "other" = anything else

Infer reasonable defaults:
- If user mentions "HA" or "high availability", use quantity >= 2
- If user mentions specific AZs, note in constraints
- Default region is us-east-1 unless specified
- Default instance type is t3.micro unless specified
- Default database is PostgreSQL unless specified

Output ONLY the JSON, no explanation."""


def parse_nl_to_spec_with_llm(prompt: str, api_key: str | None = None) -> TopologySpec:
    """Parse natural language prompt to TopologySpec using OpenAI API."""
    import httpx

    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        # Fall back to rule-based parsing
        return parse_nl_to_spec_rules(prompt)

    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 1000,
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if json_match:
            content = json_match.group(1)

        spec_dict = json.loads(content)
        return _dict_to_spec(spec_dict)

    except Exception as e:
        print(f"LLM parsing failed: {e}, falling back to rule-based parsing")
        return parse_nl_to_spec_rules(prompt)


def parse_nl_to_spec_rules(prompt: str) -> TopologySpec:
    """Parse natural language prompt to TopologySpec using rule-based approach."""
    prompt_lower = prompt.lower().strip()
    components: list[ComponentSpec] = []

    # Check if prompt is too short or just a greeting
    greetings = ["hi", "hello", "hey", "help", "test", "yo", "sup"]
    if len(prompt_lower) < 10 or prompt_lower in greetings:
        # Return empty components - the API will handle this with a helpful message
        return TopologySpec(
            provider="aws",
            region="us-east-1",
            components=[],  # Empty = prompt not understood
        )

    # Detect region
    region = "us-east-1"
    region_patterns = {
        "us-east-1": ["us-east-1", "n. virginia", "virginia", "east"],
        "us-east-2": ["us-east-2", "ohio"],
        "us-west-1": ["us-west-1", "n. california", "california"],
        "us-west-2": ["us-west-2", "oregon", "west"],
        "eu-west-1": ["eu-west-1", "ireland", "europe"],
        "eu-central-1": ["eu-central-1", "frankfurt", "germany"],
        "ap-northeast-1": ["ap-northeast-1", "tokyo", "japan"],
        "ap-southeast-1": ["ap-southeast-1", "singapore"],
    }
    for reg, patterns in region_patterns.items():
        if any(p in prompt_lower for p in patterns):
            region = reg
            break

    # Detect networking-only request (VPC, subnets without compute)
    networking_keywords = ["vpc", "subnet", "network", "cidr", "private subnet", "public subnet"]
    has_networking = any(kw in prompt_lower for kw in networking_keywords)
    
    # Detect web tier
    web_keywords = ["web server", "web tier", "application server", "app server", 
                    "ec2", "instance", "server", "backend", "api server", "nginx", 
                    "apache", "compute", "vm", "virtual machine", "host"]
    has_web = any(kw in prompt_lower for kw in web_keywords)
    
    if has_web:
        quantity = _extract_quantity(prompt_lower, ["server", "instance", "ec2", "host", "vm"])
        
        # Check for HA requirements
        if any(kw in prompt_lower for kw in ["ha", "high availability", "redundant", "fault tolerant", "multi-az", "across az"]):
            quantity = max(quantity, 2)
        
        # Check instance type
        instance_type = "t3.micro"
        if "large" in prompt_lower:
            instance_type = "t3.large"
        elif "medium" in prompt_lower:
            instance_type = "t3.medium"
        elif "small" in prompt_lower:
            instance_type = "t3.small"
        
        components.append(
            ComponentSpec(
                role=ComponentRole.WEB_TIER,
                quantity=quantity,
                description="Web/Application servers",
                constraints={"instance_type": instance_type},
            )
        )

    # Detect database tier
    db_keywords = ["database", "db", "rds", "postgres", "postgresql", "mysql", 
                   "mariadb", "sql", "aurora", "data store", "datastore"]
    has_db = any(kw in prompt_lower for kw in db_keywords)
    
    if has_db:
        # Detect engine
        engine = "postgres"  # default
        if "mysql" in prompt_lower or "mariadb" in prompt_lower:
            engine = "mysql"
        elif "aurora" in prompt_lower:
            engine = "aurora-postgresql"
        
        # Detect instance class
        instance_class = "db.t3.micro"
        if "large" in prompt_lower:
            instance_class = "db.t3.large"
        elif "medium" in prompt_lower:
            instance_class = "db.t3.medium"
        
        components.append(
            ComponentSpec(
                role=ComponentRole.DB_TIER,
                quantity=1,
                description=f"{engine.upper()} database",
                constraints={
                    "engine": engine,
                    "instance_class": instance_class,
                },
            )
        )

    # If only networking mentioned (VPC/subnets), create minimal web setup to attach to
    if has_networking and not has_web and not has_db:
        # Check if they want just networking or also compute
        if "only" in prompt_lower or ("vpc" in prompt_lower and "server" not in prompt_lower and "instance" not in prompt_lower):
            # Just networking - add a minimal web server to make the graph useful
            components.append(
                ComponentSpec(
                    role=ComponentRole.WEB_TIER,
                    quantity=1,
                    description="Web server (for VPC demo)",
                    constraints={"instance_type": "t3.micro"},
                )
            )
        else:
            # Default: VPC with web server
            components.append(
                ComponentSpec(
                    role=ComponentRole.WEB_TIER,
                    quantity=1,
                    description="Web server in VPC",
                    constraints={"instance_type": "t3.micro"},
                )
            )
    
    # If still no components but prompt looks like infrastructure request
    infra_keywords = ["create", "build", "deploy", "setup", "provision", "launch", "make", "need", "want"]
    if not components and any(kw in prompt_lower for kw in infra_keywords):
        # Generic infrastructure request - default to web tier
        components.append(
            ComponentSpec(
                role=ComponentRole.WEB_TIER,
                quantity=1,
                description="Default infrastructure",
                constraints={"instance_type": "t3.micro"},
            )
        )

    return TopologySpec(
        provider="aws",
        region=region,
        components=components,
    )


def _extract_quantity(text: str, keywords: list[str]) -> int:
    """Extract quantity from text near keywords."""
    # Look for patterns like "3 servers", "two instances", etc.
    number_words = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    }
    
    # First, try to find a number at the start of the text or after common words
    # Pattern: "create 2 servers", "2 web servers", etc.
    general_pattern = r"(?:create|deploy|setup|add|with|need|want)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:web\s+)?(?:" + "|".join(keywords) + r")s?"
    match = re.search(general_pattern, text, re.IGNORECASE)
    if match:
        num_str = match.group(1).lower()
        if num_str.isdigit():
            return int(num_str)
        return number_words.get(num_str, 1)
    
    for kw in keywords:
        # Pattern: "N keyword" or "keyword N"
        pattern = rf"(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+{kw}s?"
        match = re.search(pattern, text)
        if match:
            num_str = match.group(1)
            if num_str.isdigit():
                return int(num_str)
            return number_words.get(num_str, 1)
        
        # Pattern: "keyword: N" or "keyword (N)"
        pattern = rf"{kw}s?\s*[:(\[]\s*(\d+)"
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))
    
    return 1  # Default to 1


def _dict_to_spec(spec_dict: dict[str, Any]) -> TopologySpec:
    """Convert a dictionary to TopologySpec."""
    components = []
    for comp in spec_dict.get("components", []):
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
        provider=spec_dict.get("provider", "aws"),
        region=spec_dict.get("region", "us-east-1"),
        components=components,
    )


def parse_nl_to_spec(prompt: str) -> TopologySpec:
    """Parse natural language to TopologySpec. Uses LLM if available, otherwise rules."""
    if os.environ.get("OPENAI_API_KEY"):
        return parse_nl_to_spec_with_llm(prompt)
    return parse_nl_to_spec_rules(prompt)
