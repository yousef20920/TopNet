# app/core/user_data_generator.py
"""Generate AWS EC2 User Data scripts for application deployment."""

import base64
import re
from typing import Any

from app.core import TopologyGraph, BaseNode, NodeKind


# Project-specific installation and run commands
PROJECT_CONFIGS = {
    "nodejs": {
        "packages": ["nodejs", "npm"],
        "install_cmd": "npm install",
        "build_cmd": "npm run build --if-present",
        "start_cmd": "npm start",
        "process_manager": "pm2",
    },
    "python": {
        "packages": ["python3", "python3-pip", "python3-venv"],
        "install_cmd": "pip3 install -r requirements.txt",
        "start_cmd": "python3 app.py",
    },
    "go": {
        "packages": ["golang"],
        "install_cmd": "go mod download",
        "build_cmd": "go build -o app",
        "start_cmd": "./app",
    },
    "java": {
        "packages": ["java-17-amazon-corretto-devel", "maven"],
        "install_cmd": "mvn install -DskipTests",
        "build_cmd": "mvn package -DskipTests",
        "start_cmd": "java -jar target/*.jar",
    },
    "ruby": {
        "packages": ["ruby", "ruby-devel"],
        "install_cmd": "bundle install",
        "start_cmd": "bundle exec ruby app.rb",
    },
    "php": {
        "packages": ["php", "php-fpm", "composer"],
        "install_cmd": "composer install",
        "start_cmd": "php -S 0.0.0.0:${PORT:-80}",
    },
    "static": {
        "packages": ["nginx"],
        "install_cmd": "",
        "start_cmd": "systemctl start nginx",
    },
    "docker": {
        "packages": ["docker"],
        "install_cmd": "",
        "start_cmd": "docker-compose up -d",
    },
    "custom": {
        "packages": [],
        "install_cmd": "",
        "start_cmd": "",
    },
}


def resolve_node_references(
    value: str,
    nodes: list[BaseNode],
    node_id_map: dict[str, str] | None = None
) -> str:
    """
    Resolve node references in environment variable values.
    e.g., "{{RDS_Database_1.endpoint}}" -> Terraform reference
    """
    pattern = r"\{\{([^.}]+)\.([^}]+)\}\}"

    def replace_ref(match: re.Match) -> str:
        node_ref = match.group(1)
        prop = match.group(2)

        # Find the node by name or id
        node = None
        for n in nodes:
            if n.name == node_ref or n.id == node_ref:
                node = n
                break

        if not node:
            # Return as Terraform variable for runtime resolution
            return f"${{{node_ref}.{prop}}}"

        # Generate Terraform reference based on node type
        tf_name = node.id.replace("-", "_")

        if node.kind == NodeKind.DATABASE:
            if prop == "endpoint":
                return f"${{aws_db_instance.{tf_name}.endpoint}}"
            if prop == "port":
                return f"${{aws_db_instance.{tf_name}.port}}"
            if prop == "address":
                return f"${{aws_db_instance.{tf_name}.address}}"
        elif node.kind == NodeKind.COMPUTE_INSTANCE:
            if prop == "private_ip":
                return f"${{aws_instance.{tf_name}.private_ip}}"
            if prop == "public_ip":
                return f"${{aws_instance.{tf_name}.public_ip}}"
        elif node.kind == NodeKind.LOAD_BALANCER:
            if prop == "dns_name":
                return f"${{aws_lb.{tf_name}.dns_name}}"

        # Fallback
        return f"${{{tf_name}.{prop}}}"

    return re.sub(pattern, replace_ref, value)


def generate_env_exports(
    env_vars: list[dict[str, Any]],
    nodes: list[BaseNode]
) -> str:
    """Generate environment variable export statements."""
    if not env_vars:
        return ""

    exports = []
    env_lines = []

    for env in env_vars:
        key = env.get("key", "")
        value = env.get("value", "")
        resolved = resolve_node_references(value, nodes)
        escaped = resolved.replace('"', '\\"')
        exports.append(f'export {key}="{escaped}"')
        env_lines.append(f'{key}="{resolved}"')

    return f"""
# Application Environment Variables
cat >> /etc/environment << 'ENVEOF'
{chr(10).join(env_lines)}
ENVEOF

# Export for current session
{chr(10).join(exports)}
"""


def generate_user_data_script(
    app_config: dict[str, Any],
    nodes: list[BaseNode] | None = None
) -> str:
    """Generate the complete User Data script for an EC2 instance."""
    if not app_config:
        return ""

    source = app_config.get("source")
    if not source:
        return ""

    nodes = nodes or []
    env_vars = app_config.get("envVars", [])
    enable_https = app_config.get("enableHttps", False)
    domain = app_config.get("domain", "")
    enable_pm2 = app_config.get("enableProcessManager", False)

    project_type = source.get("projectType", "nodejs")
    config = PROJECT_CONFIGS.get(project_type, PROJECT_CONFIGS["custom"])

    repo_url = source.get("repoUrl", "")
    branch = source.get("branch", "main")
    work_dir = source.get("workDir", "")
    app_port = source.get("appPort", 3000)

    # Extract repo name from URL
    repo_name = repo_url.split("/")[-1].replace(".git", "") if repo_url else "app"
    app_path = f"/opt/{repo_name}" + (f"/{work_dir}" if work_dir else "")

    # Use custom commands if provided, otherwise use defaults
    install_cmd = source.get("buildCommand") or config.get("install_cmd", "")
    start_cmd = source.get("startCommand") or config.get("start_cmd", "")
    build_cmd = config.get("build_cmd", "")

    packages = config.get("packages", [])

    # Generate the script
    script_parts = [
        f"""#!/bin/bash
set -e

# ==========================================
# TopNet Auto-Generated User Data Script
# Project Type: {project_type}
# Repository: {repo_url}
# ==========================================

exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting application deployment at $(date)"

# Update system packages
yum update -y || apt-get update -y

# Install Git
yum install -y git || apt-get install -y git
"""
    ]

    # Install project dependencies
    if packages:
        if project_type == "nodejs":
            script_parts.append("""
# Install Node.js via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
yum install -y nodejs || apt-get install -y nodejs
""")
        else:
            pkg_str = " ".join(packages)
            script_parts.append(f"""
# Install project dependencies
yum install -y {pkg_str} || apt-get install -y {pkg_str}
""")

    # Install PM2 if enabled
    if enable_pm2 and project_type == "nodejs":
        script_parts.append("""
# Install PM2 process manager
npm install -g pm2
""")

    # Clone repository
    script_parts.append(f"""
# Clone the repository
echo "Cloning repository..."
git clone --branch {branch} {repo_url} /opt/{repo_name}
cd {app_path}
""")

    # Environment variables
    if env_vars:
        script_parts.append(generate_env_exports(env_vars, nodes))

    # Install dependencies
    if install_cmd:
        script_parts.append(f"""
# Install application dependencies
echo "Installing dependencies..."
{install_cmd}
""")

    # Build
    if build_cmd:
        script_parts.append(f"""
# Build the application
echo "Building application..."
{build_cmd}
""")

    # HTTPS setup
    if enable_https and domain:
        script_parts.append(f"""
# Setup Let's Encrypt SSL
yum install -y certbot python3-certbot-nginx || apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d {domain} --non-interactive --agree-tos --email admin@{domain} || true
""")

    # Static site configuration
    if project_type == "static":
        server_name = f"server_name {domain};" if domain else ""
        script_parts.append(f"""
# Configure Nginx for static files
cat > /etc/nginx/conf.d/{repo_name}.conf << 'NGINXEOF'
server {{
    listen 80;
    {server_name}
    root {app_path};
    index index.html;

    location / {{
        try_files $uri $uri/ /index.html;
    }}
}}
NGINXEOF
systemctl restart nginx
""")
    # Docker configuration
    elif project_type == "docker":
        script_parts.append(f"""
# Start Docker service
systemctl start docker
systemctl enable docker
cd {app_path}
docker-compose up -d
""")
    # Application service (for non-static, non-docker)
    elif project_type not in ("static", "docker"):
        exec_start = f"pm2 start {start_cmd.replace('npm start', 'npm -- start')} --name {repo_name}" if enable_pm2 and project_type == "nodejs" else f"/bin/bash -c '{start_cmd}'"

        script_parts.append(f"""
# Create systemd service for the application
cat > /etc/systemd/system/{repo_name}.service << 'SERVICEEOF'
[Unit]
Description={repo_name} application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={app_path}
EnvironmentFile=/etc/environment
ExecStart={exec_start}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Start the application
systemctl daemon-reload
systemctl enable {repo_name}
systemctl start {repo_name}
""")

    # CloudWatch logging
    script_parts.append(f"""
# Setup CloudWatch logging (if available)
if command -v amazon-cloudwatch-agent &> /dev/null; then
    cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWEOF'
{{
    "logs": {{
        "logs_collected": {{
            "files": {{
                "collect_list": [
                    {{
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "/topnet/{repo_name}",
                        "log_stream_name": "{{instance_id}}/user-data"
                    }}
                ]
            }}
        }}
    }}
}}
CWEOF
    systemctl restart amazon-cloudwatch-agent || true
fi

echo "Application deployment completed at $(date)"
echo "Application should be running on port {app_port}"
""")

    return "".join(script_parts)


def encode_user_data(script: str) -> str:
    """Encode user data script to base64 for Terraform."""
    return base64.b64encode(script.encode("utf-8")).decode("utf-8")
