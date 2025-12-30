// src/utils/graphConverter.ts
// Convert TopologyGraph to React Flow nodes and edges

import type { Node, Edge } from '@xyflow/react';
import type { Edge as TopologyEdge, TopologyGraph } from '../types/topology';
import dagre from 'dagre';

// Use dagre to calculate layout
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220; // Width matching CustomNode
  const nodeHeight = 80; // Height matching CustomNode

  dagreGraph.setGraph({ rankdir: 'LR' }); // Left to Right layout

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

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

export function convertToReactFlowNodes(topology: TopologyGraph): Node[] {
  // Create initial nodes without position
  const initialNodes: Node[] = topology.nodes.map((node) => {
    return {
      id: node.id,
      type: 'custom', // Use custom node type
      position: { x: 0, y: 0 }, // Position will be set by dagre
      data: {
        label: node.name || node.id,
        ...node,
      },
    };
  });

  // Calculate edges for layout (we need edges to calculate node positions)
  const initialEdges = convertToReactFlowEdges(topology);

  // Apply dagre layout
  const { nodes } = getLayoutedElements(initialNodes, initialEdges);

  return nodes;
}
