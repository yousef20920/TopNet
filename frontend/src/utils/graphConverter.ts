// src/utils/graphConverter.ts
// Convert TopologyGraph to React Flow nodes and edges

import type { Node, Edge } from '@xyflow/react';
import type { BaseNode, Edge as TopologyEdge, TopologyGraph, NodeKind } from '../types/topology';

// Color scheme for different node kinds
const NODE_COLORS: Record<NodeKind, string> = {
  network: '#4F46E5',        // Indigo - VPC
  subnet: '#10B981',         // Emerald - Subnets
  security_group: '#F59E0B', // Amber - Security Groups
  load_balancer: '#8B5CF6',  // Violet - ALB
  compute_instance: '#3B82F6', // Blue - EC2
  database: '#EF4444',       // Red - RDS
  gateway: '#06B6D4',        // Cyan - Gateways
  traffic_generator: '#EC4899', // Pink
  route_table: '#6B7280',    // Gray - Route Tables
};

// Icons/labels for node kinds
const NODE_LABELS: Record<NodeKind, string> = {
  network: '🌐 VPC',
  subnet: '📦 Subnet',
  security_group: '🔒 SG',
  load_balancer: '⚖️ ALB',
  compute_instance: '💻 EC2',
  database: '🗄️ RDS',
  gateway: '🚪 Gateway',
  traffic_generator: '📡 Traffic Gen',
  route_table: '🛣️ Route Table',
};

// Calculate positions based on node kind (simple layered layout)
function calculatePosition(node: BaseNode, _index: number, allNodes: BaseNode[]): { x: number; y: number } {
  const layerOrder: NodeKind[] = [
    'network',
    'gateway',
    'route_table',
    'subnet',
    'security_group',
    'load_balancer',
    'compute_instance',
    'database',
    'traffic_generator',
  ];

  const layer = layerOrder.indexOf(node.kind);
  const nodesInLayer = allNodes.filter(n => n.kind === node.kind);
  const indexInLayer = nodesInLayer.findIndex(n => n.id === node.id);
  
  const xSpacing = 250;
  const ySpacing = 120;
  const layerWidth = nodesInLayer.length * xSpacing;
  const startX = (1200 - layerWidth) / 2 + 100;

  return {
    x: startX + indexInLayer * xSpacing,
    y: 50 + layer * ySpacing,
  };
}

export function convertToReactFlowNodes(topology: TopologyGraph): Node[] {
  return topology.nodes.map((node, index) => {
    const position = calculatePosition(node, index, topology.nodes);
    
    return {
      id: node.id,
      type: 'default',
      position,
      data: {
        label: (
          `${NODE_LABELS[node.kind] || node.kind}\n${node.name || node.id}`
        ),
        ...node,
      },
      style: {
        background: NODE_COLORS[node.kind] || '#6B7280',
        color: 'white',
        border: '2px solid #374151',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '12px',
        fontWeight: 500,
        minWidth: '120px',
        textAlign: 'center' as const,
      },
    };
  });
}

// Edge styles based on kind
const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string }> = {
  attached_to: { stroke: '#6B7280' },
  routes_to: { stroke: '#10B981', strokeDasharray: '5,5' },
  allowed_traffic: { stroke: '#F59E0B' },
  depends_on: { stroke: '#EF4444', strokeDasharray: '3,3' },
  contains: { stroke: '#8B5CF6' },
};

export function convertToReactFlowEdges(topology: TopologyGraph): Edge[] {
  return topology.edges.map((edge: TopologyEdge) => {
    const style = EDGE_STYLES[edge.kind] || { stroke: '#9CA3AF' };
    
    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: edge.kind === 'allowed_traffic',
      style: {
        stroke: style.stroke,
        strokeWidth: 2,
        strokeDasharray: style.strokeDasharray,
      },
      label: edge.kind === 'allowed_traffic' ? '→' : undefined,
      data: { ...edge } as Record<string, unknown>,
    };
  });
}
