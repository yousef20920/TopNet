// src/api/topologyApi.ts
// API client for topology endpoints

import type { TopologyGraph, GenerateResponse, ValidationResult } from '../types/topology';

const API_BASE = 'http://localhost:3001/api';

export async function generateTopology(prompt: string): Promise<GenerateResponse> {
  const response = await fetch(`${API_BASE}/topologies/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate topology: ${response.statusText}`);
  }
  
  return response.json();
}

export async function generateTopologyFromSpec(spec: Record<string, unknown>): Promise<GenerateResponse> {
  const response = await fetch(`${API_BASE}/topologies/generate-from-spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate topology: ${response.statusText}`);
  }
  
  return response.json();
}

export async function validateTopology(topology: TopologyGraph): Promise<{ validation: ValidationResult[] }> {
  const response = await fetch(`${API_BASE}/topologies/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topology }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to validate topology: ${response.statusText}`);
  }
  
  return response.json();
}

export async function generateTerraform(topology: TopologyGraph): Promise<{ files: { filename: string; content: string }[] }> {
  const response = await fetch(`${API_BASE}/topologies/terraform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topology }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to generate Terraform: ${response.statusText}`);
  }
  
  return response.json();
}

export interface CostItem {
  resource: string;
  type: string;
  hourly: number;
  monthly: number;
}

export interface CostEstimate {
  items: CostItem[];
  hourly_total: number;
  monthly_total: number;
  currency: string;
  note: string;
  free_tier_note?: string;
}

export async function estimateCost(topology: TopologyGraph): Promise<CostEstimate> {
  const response = await fetch(`${API_BASE}/topologies/estimate-cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topology }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to estimate cost: ${response.statusText}`);
  }
  
  return response.json();
}
