// src/types/topology.ts
// Shared types matching the backend

export type Provider = "aws" | "azure" | "gcp" | "generic";

export type NodeKind =
  | "network"
  | "subnet"
  | "security_group"
  | "load_balancer"
  | "compute_instance"
  | "database"
  | "gateway"
  | "traffic_generator"
  | "route_table";

export type EdgeKind =
  | "attached_to"
  | "routes_to"
  | "allowed_traffic"
  | "depends_on"
  | "contains";

export interface BaseNode {
  id: string;
  kind: NodeKind;
  name?: string;
  provider?: Provider;
  region?: string;
  az?: string;
  tags?: Record<string, string>;
  props: Record<string, any>;
}

export interface Edge {
  id: string;
  kind: EdgeKind;
  from: string;
  to: string;
  props?: Record<string, any>;
}

export interface TopologyGraph {
  id: string;
  name?: string;
  nodes: BaseNode[];
  edges: Edge[];
  metadata?: Record<string, any>;
}

export type Severity = "info" | "warning" | "error";

export interface ValidationResult {
  id: string;
  severity: Severity;
  message: string;
  nodeIds?: string[];
}

export interface GenerateResponse {
  topology: TopologyGraph;
  validation: ValidationResult[];
}

// ============================================
// Code Injection / Application Deployment Types
// ============================================

export type ProjectType =
  | "nodejs"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "php"
  | "static"
  | "docker"
  | "custom";

export interface ApplicationSource {
  /** GitHub repository URL (e.g., https://github.com/user/repo) */
  repoUrl: string;
  /** Branch to clone (defaults to 'main') */
  branch?: string;
  /** Project type for auto-detecting build/run commands */
  projectType: ProjectType;
  /** Custom build command (overrides auto-detected) */
  buildCommand?: string;
  /** Custom start command (overrides auto-detected) */
  startCommand?: string;
  /** Working directory within the repo */
  workDir?: string;
  /** Port the application listens on */
  appPort?: number;
}

export interface EnvironmentVariable {
  /** Variable name (e.g., DATABASE_URL) */
  key: string;
  /**
   * Variable value - can be:
   * - Static string: "my-value"
   * - Node reference: "{{RDS_Database_1.endpoint}}"
   * - Node reference with port: "{{RDS_Database_1.endpoint}}:{{RDS_Database_1.port}}"
   */
  value: string;
  /** Whether this is a secret (will be marked for secure handling) */
  isSecret?: boolean;
}

export interface ApplicationConfig {
  /** Source code configuration */
  source?: ApplicationSource;
  /** Environment variables for the application */
  envVars?: EnvironmentVariable[];
  /** Enable automatic HTTPS with Let's Encrypt */
  enableHttps?: boolean;
  /** Domain name for the application */
  domain?: string;
  /** Enable PM2 process manager for Node.js apps */
  enableProcessManager?: boolean;
}

/** Extended compute instance props with application config */
export interface ComputeInstanceProps {
  instance_type?: string;
  ami?: string;
  key_pair?: string;
  /** Application deployment configuration */
  application?: ApplicationConfig;
  [key: string]: unknown;
}
