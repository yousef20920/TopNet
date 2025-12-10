import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Play,
    Download,
    AlertCircle,
    Loader2,
    Zap,
    Rocket,
    FileCode,
    Layout
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { TopologyGraph, ValidationResult, BaseNode } from '../types/topology';
import { generateTopology, generateTerraform } from '../api/topologyApi';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { NodeInspector } from '../components/NodeInspector';
import { ValidationPanel } from '../components/ValidationPanel';
import { DeployPanel } from '../components/DeployPanel';

export function EditorPage() {
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
        <div className="h-screen flex flex-col bg-[#09090b] text-white overflow-hidden font-sans">
            {/* Top Navigation */}
            <header className="h-14 bg-black/40 border-b border-white/10 flex items-center justify-between px-4 shrink-0 backdrop-blur-md z-20">
                <div className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="p-2 -ml-2 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-white fill-current" />
                        </div>
                        <span className="font-semibold text-sm tracking-wide">TopNet Editor</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10 mx-2" />
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Layout className="w-3.5 h-3.5" />
                        <span>{topology?.name || 'Untitled Topology'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {topology && (
                        <>
                            <button
                                onClick={handleGenerateTerraform}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                <FileCode className="w-3.5 h-3.5" />
                                Wait for Terraform
                            </button>
                            <button
                                onClick={() => setIsDeployPanelOpen(true)}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
                            >
                                <Rocket className="w-3.5 h-3.5" />
                                Deploy
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Controls */}
                <div className="w-80 bg-[#0c0c0e] border-r border-white/5 flex flex-col z-10 shadow-xl">
                    <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">

                        {/* Prompt Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Prompt
                            </label>
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe your infrastructure..."
                                    className="w-full h-32 px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                                />
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className={cn(
                                        "absolute bottom-2 right-2 p-1.5 rounded-md transition-all",
                                        isLoading
                                            ? "bg-gray-700 cursor-not-allowed"
                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                                    )}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4 fill-current" />
                                    )}
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500">
                                Try "Create a VPC with public/private subnets and an RDS instance."
                            </p>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                                <p className="text-xs text-red-200">{error}</p>
                            </div>
                        )}

                        {/* Validation Panel */}
                        <div className="border-t border-white/5 pt-4">
                            <ValidationPanel results={validation} />
                        </div>

                        {/* Terraform Output Preview */}
                        {terraformOutput && (
                            <div className="flex-1 min-h-[200px] flex flex-col border-t border-white/5 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Terraform Output</span>
                                    <button
                                        onClick={handleDownloadTerraform}
                                        className="p-1 hover:bg-white/10 rounded transition-colors"
                                        title="Download JSON"
                                    >
                                        <Download className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="flex-1 relative group">
                                    <pre className="absolute inset-0 p-3 bg-black/30 rounded-lg border border-white/5 text-[10px] text-green-400 font-mono overflow-auto">
                                        {terraformOutput}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Canvas */}
                <div className="flex-1 bg-grid-black/[0.2] relative bg-[#030304]">
                    <TopologyCanvas topology={topology} onNodeSelect={setSelectedNode} />

                    {/* Canvas Overlay Info */}
                    {!topology && !isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 pointer-events-none">
                            <Layout className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-sm font-medium opacity-40">Canvas Empty</p>
                            <p className="text-xs opacity-30 mt-1">Generate a topology to start</p>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Inspector */}
                <div className={cn(
                    "w-72 bg-[#0c0c0e] border-l border-white/5 flex flex-col transition-all duration-300",
                    selectedNode ? "translate-x-0" : "translate-x-full w-0 opacity-0"
                )}>
                    <div className="p-4 border-b border-white/5">
                        <h2 className="text-sm font-semibold text-gray-200">Properties</h2>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <NodeInspector node={selectedNode} />
                    </div>
                </div>
            </div>

            {/* Deploy Logic */}
            <DeployPanel
                topology={topology}
                isOpen={isDeployPanelOpen}
                onClose={() => setIsDeployPanelOpen(false)}
            />
        </div>
    );
}
