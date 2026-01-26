// src/utils/userDataGenerator.ts
// Generates AWS EC2 User Data scripts for application deployment

import type {
  ApplicationSource,
  EnvironmentVariable,
  ApplicationConfig,
  ProjectType,
  BaseNode,
} from '../types/topology';

/**
 * Project-specific installation and run commands
 */
const PROJECT_CONFIGS: Record<ProjectType, {
  packages: string[];
  installCmd: string;
  buildCmd?: string;
  startCmd: string;
  processManager?: string;
}> = {
  nodejs: {
    packages: ['nodejs', 'npm'],
    installCmd: 'npm install',
    buildCmd: 'npm run build --if-present',
    startCmd: 'npm start',
    processManager: 'pm2',
  },
  python: {
    packages: ['python3', 'python3-pip', 'python3-venv'],
    installCmd: 'pip3 install -r requirements.txt',
    startCmd: 'python3 app.py',
  },
  go: {
    packages: ['golang'],
    installCmd: 'go mod download',
    buildCmd: 'go build -o app',
    startCmd: './app',
  },
  java: {
    packages: ['java-17-amazon-corretto-devel', 'maven'],
    installCmd: 'mvn install -DskipTests',
    buildCmd: 'mvn package -DskipTests',
    startCmd: 'java -jar target/*.jar',
  },
  ruby: {
    packages: ['ruby', 'ruby-devel'],
    installCmd: 'bundle install',
    startCmd: 'bundle exec ruby app.rb',
  },
  php: {
    packages: ['php', 'php-fpm', 'composer'],
    installCmd: 'composer install',
    startCmd: 'php -S 0.0.0.0:${PORT:-80}',
  },
  static: {
    packages: ['nginx'],
    installCmd: '',
    startCmd: 'systemctl start nginx',
  },
  docker: {
    packages: ['docker'],
    installCmd: '',
    startCmd: 'docker-compose up -d',
  },
  custom: {
    packages: [],
    installCmd: '',
    startCmd: '',
  },
};

/**
 * Resolves node references in environment variable values
 * e.g., "{{RDS_Database_1.endpoint}}" -> actual endpoint value
 */
export function resolveNodeReferences(
  value: string,
  nodes: BaseNode[],
  resolvedOutputs?: Map<string, Record<string, string>>
): string {
  // Pattern: {{NodeName.property}} or {{node_id.property}}
  const pattern = /\{\{([^.}]+)\.([^}]+)\}\}/g;

  return value.replace(pattern, (match, nodeRef, property) => {
    // Find the node by name or id
    const node = nodes.find(
      n => n.name === nodeRef || n.id === nodeRef
    );

    if (!node) {
      // Return Terraform reference format for runtime resolution
      return `\${${nodeRef}.${property}}`;
    }

    // Check if we have resolved outputs (for preview)
    if (resolvedOutputs?.has(node.id)) {
      const outputs = resolvedOutputs.get(node.id)!;
      if (property in outputs) {
        return outputs[property];
      }
    }

    // Return Terraform-style reference for deployment
    // This will be resolved by Terraform at deploy time
    const terraformResourceName = node.id.replace(/-/g, '_');

    switch (node.kind) {
      case 'database':
        if (property === 'endpoint') {
          return `\${aws_db_instance.${terraformResourceName}.endpoint}`;
        }
        if (property === 'port') {
          return `\${aws_db_instance.${terraformResourceName}.port}`;
        }
        if (property === 'address') {
          return `\${aws_db_instance.${terraformResourceName}.address}`;
        }
        break;
      case 'compute_instance':
        if (property === 'private_ip') {
          return `\${aws_instance.${terraformResourceName}.private_ip}`;
        }
        if (property === 'public_ip') {
          return `\${aws_instance.${terraformResourceName}.public_ip}`;
        }
        break;
      case 'load_balancer':
        if (property === 'dns_name') {
          return `\${aws_lb.${terraformResourceName}.dns_name}`;
        }
        break;
    }

    // Fallback: return as Terraform reference
    return `\${${terraformResourceName}.${property}}`;
  });
}

/**
 * Generates environment variable export statements
 */
function generateEnvExports(
  envVars: EnvironmentVariable[],
  nodes: BaseNode[]
): string {
  if (!envVars || envVars.length === 0) return '';

  const exports = envVars.map(env => {
    const resolvedValue = resolveNodeReferences(env.value, nodes);
    // Escape special characters and wrap in quotes
    const escapedValue = resolvedValue.replace(/"/g, '\\"');
    return `export ${env.key}="${escapedValue}"`;
  });

  return `
# Application Environment Variables
cat >> /etc/environment << 'ENVEOF'
${envVars.map(env => `${env.key}="${resolveNodeReferences(env.value, nodes)}"`).join('\n')}
ENVEOF

# Export for current session
${exports.join('\n')}
`;
}

/**
 * Generates the complete User Data script for an EC2 instance
 */
export function generateUserDataScript(
  config: ApplicationConfig,
  nodes: BaseNode[] = []
): string {
  if (!config.source) {
    return '';
  }

  const { source, envVars = [], enableHttps, domain, enableProcessManager } = config;
  const projectConfig = PROJECT_CONFIGS[source.projectType];

  const branch = source.branch || 'main';
  const workDir = source.workDir || '';
  const appPort = source.appPort || 3000;
  const repoName = source.repoUrl.split('/').pop()?.replace('.git', '') || 'app';
  const appPath = `/opt/${repoName}${workDir ? `/${workDir}` : ''}`;

  // Use custom commands if provided, otherwise use defaults
  const installCmd = source.buildCommand || projectConfig.installCmd;
  const startCmd = source.startCommand || projectConfig.startCmd;
  const buildCmd = projectConfig.buildCmd || '';

  const script = `#!/bin/bash
set -e

# ==========================================
# TopNet Auto-Generated User Data Script
# Project Type: ${source.projectType}
# Repository: ${source.repoUrl}
# ==========================================

exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting application deployment at $(date)"

# Update system packages
yum update -y || apt-get update -y

# Install Git
yum install -y git || apt-get install -y git

${projectConfig.packages.length > 0 ? `
# Install project dependencies
${source.projectType === 'nodejs' ? `
# Install Node.js via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - || curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
yum install -y nodejs || apt-get install -y nodejs
` : `
yum install -y ${projectConfig.packages.join(' ')} || apt-get install -y ${projectConfig.packages.join(' ')}
`}` : ''}

${enableProcessManager && source.projectType === 'nodejs' ? `
# Install PM2 process manager
npm install -g pm2
` : ''}

# Clone the repository
echo "Cloning repository..."
git clone --branch ${branch} ${source.repoUrl} /opt/${repoName}
cd ${appPath}

${generateEnvExports(envVars, nodes)}

${installCmd ? `
# Install application dependencies
echo "Installing dependencies..."
${installCmd}
` : ''}

${buildCmd ? `
# Build the application
echo "Building application..."
${buildCmd}
` : ''}

${enableHttps && domain ? `
# Setup Let's Encrypt SSL
yum install -y certbot python3-certbot-nginx || apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d ${domain} --non-interactive --agree-tos --email admin@${domain} || true
` : ''}

${source.projectType === 'static' ? `
# Configure Nginx for static files
cat > /etc/nginx/conf.d/${repoName}.conf << 'NGINXEOF'
server {
    listen 80;
    ${domain ? `server_name ${domain};` : ''}
    root ${appPath};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF
systemctl restart nginx
` : ''}

${source.projectType === 'docker' ? `
# Start Docker service
systemctl start docker
systemctl enable docker
cd ${appPath}
docker-compose up -d
` : ''}

${source.projectType !== 'static' && source.projectType !== 'docker' ? `
# Create systemd service for the application
cat > /etc/systemd/system/${repoName}.service << 'SERVICEEOF'
[Unit]
Description=${repoName} application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${appPath}
EnvironmentFile=/etc/environment
ExecStart=${enableProcessManager && source.projectType === 'nodejs'
  ? `pm2 start ${startCmd.replace('npm start', 'npm -- start')} --name ${repoName}`
  : `/bin/bash -c '${startCmd}'`}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Start the application
systemctl daemon-reload
systemctl enable ${repoName}
systemctl start ${repoName}
` : ''}

# Setup CloudWatch logging (if available)
if command -v amazon-cloudwatch-agent &> /dev/null; then
    cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWEOF'
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "/topnet/${repoName}",
                        "log_stream_name": "{instance_id}/user-data"
                    }
                ]
            }
        }
    }
}
CWEOF
    systemctl restart amazon-cloudwatch-agent || true
fi

echo "Application deployment completed at $(date)"
echo "Application should be running on port ${appPort}"
`;

  return script;
}

/**
 * Encodes the user data script for Terraform (base64)
 */
export function encodeUserDataForTerraform(script: string): string {
  // In browser, use btoa; in Node.js, use Buffer
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(script)));
  }
  return Buffer.from(script, 'utf-8').toString('base64');
}

/**
 * Generates a preview of what the user data will do
 */
export function generateUserDataPreview(config: ApplicationConfig): string[] {
  const steps: string[] = [];

  if (!config.source) {
    return ['No application source configured'];
  }

  const { source, envVars = [], enableHttps, domain, enableProcessManager } = config;

  steps.push(`Clone ${source.repoUrl} (branch: ${source.branch || 'main'})`);

  const projectConfig = PROJECT_CONFIGS[source.projectType];
  if (projectConfig.packages.length > 0) {
    steps.push(`Install: ${projectConfig.packages.join(', ')}`);
  }

  if (enableProcessManager && source.projectType === 'nodejs') {
    steps.push('Install PM2 process manager');
  }

  if (envVars.length > 0) {
    steps.push(`Set ${envVars.length} environment variable(s)`);
  }

  const installCmd = source.buildCommand || projectConfig.installCmd;
  if (installCmd) {
    steps.push(`Run: ${installCmd}`);
  }

  if (projectConfig.buildCmd) {
    steps.push(`Build: ${projectConfig.buildCmd}`);
  }

  if (enableHttps && domain) {
    steps.push(`Setup SSL certificate for ${domain}`);
  }

  const startCmd = source.startCommand || projectConfig.startCmd;
  steps.push(`Start app: ${startCmd}`);

  steps.push('Create systemd service for auto-restart');

  return steps;
}

/**
 * Validates the application configuration
 */
export function validateApplicationConfig(config: ApplicationConfig): string[] {
  const errors: string[] = [];

  if (!config.source) {
    return errors; // No source is valid (no app deployment)
  }

  const { source, envVars = [] } = config;

  // Validate repo URL
  if (!source.repoUrl) {
    errors.push('Repository URL is required');
  } else if (!source.repoUrl.match(/^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)/)) {
    errors.push('Repository URL must be from GitHub, GitLab, or Bitbucket');
  }

  // Validate project type
  if (!source.projectType) {
    errors.push('Project type is required');
  }

  // Validate env vars
  for (const env of envVars) {
    if (!env.key) {
      errors.push('Environment variable key cannot be empty');
    } else if (!env.key.match(/^[A-Z_][A-Z0-9_]*$/)) {
      errors.push(`Invalid env var name: ${env.key} (use UPPER_SNAKE_CASE)`);
    }
  }

  // Validate port
  if (source.appPort && (source.appPort < 1 || source.appPort > 65535)) {
    errors.push('App port must be between 1 and 65535');
  }

  return errors;
}
