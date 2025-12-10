// src/components/TopologyCanvas.tsx
// React Flow graph canvas for displaying topology

import { useCallback } from 'react';
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

interface TopologyCanvasProps {
  topology: TopologyGraph | null;
  onNodeSelect: (node: BaseNode | null) => void;
}

export function TopologyCanvas({ topology, onNodeSelect }: TopologyCanvasProps) {
  const initialNodes = topology ? convertToReactFlowNodes(topology) : [];
  const initialEdges = topology ? convertToReactFlowEdges(topology) : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when topology changes
  if (topology) {
    const newNodes = convertToReactFlowNodes(topology);
    const newEdges = convertToReactFlowEdges(topology);
    
    if (JSON.stringify(nodes.map(n => n.id)) !== JSON.stringify(newNodes.map(n => n.id))) {
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }

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
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap 
          nodeColor={(node) => (node.style?.background as string) || '#6B7280'}
          style={{ background: '#1F2937' }}
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#374151" />
      </ReactFlow>
    </div>
  );
}
