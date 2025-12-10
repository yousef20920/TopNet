// src/App.tsx
// Main application component

import { useState } from 'react';
import type { TopologyGraph, ValidationResult, BaseNode } from './types/topology';
import { generateTopology, generateTerraform } from './api/topologyApi';
import { TopologyCanvas } from './components/TopologyCanvas';
import { NodeInspector } from './components/NodeInspector';
import { ValidationPanel } from './components/ValidationPanel';
import { DeployPanel } from './components/DeployPanel';

function App() {
  const [prompt, setPrompt] = useState('');
  const [topology, setTopology] = useState<TopologyGraph | null>(null);
  const [validation, setValidation] = useState<ValidationResult[]>([]);
  const [selectedNode, setSelectedNode] = useState<BaseNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [terraformOutput, setTerraformOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeployPanelOpen, setIsDeployPanelOpen] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setTerraformOutput(null);
    
    try {
      const result = await generateTopology(prompt);
      setTopology(result.topology);
      setValidation(result.validation);
      setSelectedNode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate topology');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTerraform = async () => {
    if (!topology) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generateTerraform(topology);
      if (result.files.length > 0) {
        setTerraformOutput(result.files[0].content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Terraform');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTerraform = () => {
    if (!terraformOutput) return;
    
    const blob = new Blob([terraformOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.tf.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-400">🌐 TopNet</h1>
          <span className="text-sm text-gray-400">Natural-Language Cloud Topology Copilot</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Prompt & Controls */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Describe your infrastructure
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Create a VPC with public and private subnets, a web tier with load balancer, and a PostgreSQL database..."
                className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? 'Generating...' : '🚀 Generate Topology'}
            </button>

            {topology && (
              <button
                onClick={handleGenerateTerraform}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                📄 Generate Terraform
              </button>
            )}

            {topology && (
              <button
                onClick={() => setIsDeployPanelOpen(true)}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                🚀 Deploy to AWS
              </button>
            )}

            {error && (
              <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <ValidationPanel results={validation} />
          </div>

          {/* Terraform output */}
          {terraformOutput && (
            <div className="flex-1 p-4 border-t border-gray-700 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-300">Terraform Output</h3>
                <button
                  onClick={handleDownloadTerraform}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  ⬇️ Download
                </button>
              </div>
              <pre className="flex-1 text-xs bg-gray-900 p-2 rounded overflow-auto text-gray-300 font-mono">
                {terraformOutput}
              </pre>
            </div>
          )}
        </div>

        {/* Center - Graph Canvas */}
        <div className="flex-1">
          <TopologyCanvas topology={topology} onNodeSelect={setSelectedNode} />
        </div>

        {/* Right sidebar - Node Inspector */}
        <div className="w-72 bg-gray-800 border-l border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-300">Node Inspector</h2>
          </div>
          <NodeInspector node={selectedNode} />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {topology
              ? `Topology: ${topology.name || topology.id} | ${topology.nodes.length} nodes, ${topology.edges.length} edges`
              : 'No topology loaded'}
          </span>
          <span>Phase 1 - MVP</span>
        </div>
      </footer>

      {/* Deploy Panel Modal */}
      <DeployPanel 
        topology={topology} 
        isOpen={isDeployPanelOpen} 
        onClose={() => setIsDeployPanelOpen(false)} 
      />
    </div>
  );
}

export default App;
