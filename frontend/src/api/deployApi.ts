// src/api/deployApi.ts
// API client for deployment endpoints

import type { TopologyGraph } from '../types/topology';

const API_BASE = 'http://localhost:3001/api';

export interface DeploymentPrerequisites {
  ready: boolean;
  terraform_installed: boolean;
  aws_credentials_configured: boolean;
  message: string;
}

export interface TerraformFile {
  filename: string;
  content: string;
}

export type DeploymentStatus = 
  | 'pending' 
  | 'initializing' 
  | 'planning' 
  | 'applying' 
  | 'completed' 
  | 'failed' 
  | 'destroyed';

export interface PlanResponse {
  deployment_id: string;
  terraform_files: TerraformFile[];
  plan_output: string | null;
  status: DeploymentStatus;
}

export interface DeployResponse {
  deployment_id: string;
  status: DeploymentStatus;
  message: string;
}

export interface DeploymentState {
  id: string;
  status: DeploymentStatus;
  topology_id: string;
  provider: string;
  region: string;
  created_at: string;
  updated_at: string;
  message: string | null;
  outputs: Record<string, unknown> | null;
  error: string | null;
  plan_output: string | null;
  apply_output: string | null;
}

export async function checkDeployPrerequisites(): Promise<DeploymentPrerequisites> {
  const response = await fetch(`${API_BASE}/deploy/check`);
  
  if (!response.ok) {
    throw new Error(`Failed to check prerequisites: ${response.statusText}`);
  }
  
  return response.json();
}

export async function planDeployment(topology: TopologyGraph): Promise<PlanResponse> {
  const response = await fetch(`${API_BASE}/deploy/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topology }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to plan deployment');
  }
  
  return response.json();
}

export async function applyDeployment(deploymentId: string): Promise<DeployResponse> {
  const response = await fetch(`${API_BASE}/deploy/apply/${deploymentId}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to apply deployment');
  }
  
  return response.json();
}

export async function destroyDeployment(deploymentId: string): Promise<DeployResponse> {
  const response = await fetch(`${API_BASE}/deploy/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deployment_id: deploymentId }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to destroy deployment');
  }
  
  return response.json();
}

export async function getDeploymentStatus(deploymentId: string): Promise<DeploymentState> {
  const response = await fetch(`${API_BASE}/deploy/status/${deploymentId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get deployment status: ${response.statusText}`);
  }
  
  return response.json();
}

export async function listDeployments(): Promise<DeploymentState[]> {
  const response = await fetch(`${API_BASE}/deploy/list`);
  
  if (!response.ok) {
    throw new Error(`Failed to list deployments: ${response.statusText}`);
  }
  
  return response.json();
}
