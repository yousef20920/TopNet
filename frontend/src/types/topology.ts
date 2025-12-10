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
