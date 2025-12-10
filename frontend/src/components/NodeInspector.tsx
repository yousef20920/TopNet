// src/components/NodeInspector.tsx
// Side panel for inspecting selected node properties

import type { BaseNode } from '../types/topology';

interface NodeInspectorProps {
  node: BaseNode | null;
}

export function NodeInspector({ node }: NodeInspectorProps) {
  if (!node) {
    return (
      <div className="p-4 text-gray-400">
        <p className="text-sm">Select a node to view its properties</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">{node.name || node.id}</h3>
        <span className="inline-block px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded">
          {node.kind}
        </span>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">Details</h4>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">ID:</dt>
            <dd className="text-gray-200 font-mono">{node.id}</dd>
          </div>
          {node.provider && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Provider:</dt>
              <dd className="text-gray-200">{node.provider}</dd>
            </div>
          )}
          {node.region && (
            <div className="flex justify-between">
              <dt className="text-gray-400">Region:</dt>
              <dd className="text-gray-200">{node.region}</dd>
            </div>
          )}
          {node.az && (
            <div className="flex justify-between">
              <dt className="text-gray-400">AZ:</dt>
              <dd className="text-gray-200">{node.az}</dd>
            </div>
          )}
        </dl>
      </div>

      {Object.keys(node.props).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Properties</h4>
          <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-gray-200">
            {JSON.stringify(node.props, null, 2)}
          </pre>
        </div>
      )}

      {node.tags && Object.keys(node.tags).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Tags</h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(node.tags).map(([key, value]) => (
              <span
                key={key}
                className="inline-block px-2 py-0.5 text-xs bg-gray-700 text-gray-200 rounded"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
