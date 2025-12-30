// src/components/NodeInspector.tsx
// Side panel for inspecting and editing selected node properties

import { useState, useEffect } from 'react';
import type { BaseNode } from '../types/topology';
import { Save } from 'lucide-react';

interface NodeInspectorProps {
  node: BaseNode | null;
  onUpdate?: (nodeId: string, newProps: Record<string, unknown>) => void;
}

export function NodeInspector({ node, onUpdate }: NodeInspectorProps) {
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Sync local state when node changes
  useEffect(() => {
    if (node) {
      setProps(node.props || {});
      setIsDirty(false);
    }
  }, [node]);

  if (!node) {
    return (
      <div className="p-4 text-gray-400">
        <p className="text-sm">Select a node to view its properties</p>
      </div>
    );
  }

  const handlePropChange = (key: string, value: string) => {
    // Try to parse numbers or booleans
    let parsedValue: string | number | boolean = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);

    setProps(prev => ({
      ...prev,
      [key]: parsedValue
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (onUpdate && node) {
      onUpdate(node.id, props);
      setIsDirty(false);
    }
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white truncate pr-2">{node.name || node.id}</h3>
          {isDirty && (
            <button
              onClick={handleSave}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
              title="Save changes"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>
        <span className="inline-block px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded">
          {node.kind}
        </span>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs border-b border-gray-700 pb-1">Details</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between items-center group">
            <dt className="text-gray-400">ID</dt>
            <dd className="text-gray-200 font-mono text-xs bg-gray-900 px-2 py-1 rounded select-all">{node.id}</dd>
          </div>
          {node.provider && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">Provider</dt>
              <dd className="text-gray-200">{node.provider}</dd>
            </div>
          )}
          {node.region && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">Region</dt>
              <dd className="text-gray-200">{node.region}</dd>
            </div>
          )}
          {node.az && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">AZ</dt>
              <dd className="text-gray-200">{node.az}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-700 pb-1">
          <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs">Properties</h4>
          <span className="text-[10px] text-gray-500">Editable</span>
        </div>

        {Object.entries(props).length === 0 ? (
          <p className="text-xs text-gray-500 italic">No properties available</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(props).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-gray-400 font-medium block">{key}</label>
                {Array.isArray(value) || typeof value === 'object' ? (
                  <pre className="text-xs bg-gray-900 p-2 rounded text-gray-300 overflow-x-auto border border-gray-800">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => handlePropChange(key, e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {node.tags && Object.keys(node.tags).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs border-b border-gray-700 pb-1">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(node.tags).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-md"
              >
                <span className="font-medium text-gray-400 mr-1">{key}:</span> {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
