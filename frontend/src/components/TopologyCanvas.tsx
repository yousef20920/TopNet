// src/components/TopologyCanvas.tsx
// React Flow graph canvas for displaying topology

import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { TopologyGraph, BaseNode } from '../types/topology';
import { convertToReactFlowNodes, convertToReactFlowEdges } from '../utils/graphConverter';

import { CustomNode } from './CustomNode';

const nodeTypes = {
  custom: CustomNode,
};

interface TopologyCanvasProps {
  topology: TopologyGraph | null;
  onNodeSelect: (node: BaseNode | null) => void;
  highlightedNodes?: string[];
}

export function TopologyCanvas({ topology, onNodeSelect, highlightedNodes = [] }: TopologyCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Update nodes/edges when topology changes
  useEffect(() => {
    if (topology) {
      console.log('[TopologyCanvas] Updating with topology:', topology.name, topology.nodes.length, 'nodes');
      const newNodes = convertToReactFlowNodes(topology);
      const newEdges = convertToReactFlowEdges(topology);
      setNodes(newNodes);
      setEdges(newEdges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [topology, setNodes, setEdges]);

  // Apply highlighting to nodes
  useEffect(() => {
    if (highlightedNodes.length > 0) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            highlighted: highlightedNodes.includes(node.id),
          },
        }))
      );
    } else {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            highlighted: false,
          },
        }))
      );
    }
  }, [highlightedNodes, setNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const baseNode = node.data as unknown as BaseNode;
    onNodeSelect(baseNode);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  if (!topology) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-xl mb-2">No topology loaded</p>
          <p className="text-sm">Enter a prompt and click "Generate Topology" to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange<Node>}
        onEdgesChange={onEdgesChange as OnEdgesChange<Edge>}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls className="bg-gray-800 border-gray-700 text-white fill-white" />
        <MiniMap
          nodeColor={(node) => {
            const kind = node.data.kind as string;
            // Matches NODE_COLORS in CustomNode
            switch (kind) {
              case 'network': return '#4F46E5';
              case 'subnet': return '#10B981';
              case 'security_group': return '#F59E0B';
              case 'load_balancer': return '#8B5CF6';
              case 'compute_instance': return '#3B82F6';
              case 'database': return '#EF4444';
              case 'gateway': return '#06B6D4';
              case 'traffic_generator': return '#EC4899';
              case 'route_table': return '#6B7280';
              default: return '#6B7280';
            }
          }}
          style={{ background: '#111827' }}
          maskColor="#1F2937"
        />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#374151" />
      </ReactFlow>
    </div>
  );
}

