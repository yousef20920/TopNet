import { useState } from 'react';
import { motion } from 'framer-motion';
import { PanelLeft, Zap, Box, Play, LayoutDashboard, Share2 } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { ChatPanel } from '../components/ChatPanel';
import { DeploymentConsole } from '../components/DeploymentConsole';
import { AwsDashboard } from '../components/AwsDashboard';
import { cn } from '../lib/utils';
import type { TopologyGraph } from '../types/topology';
import { generateTopologyFromSpec } from '../api/topologyApi';

type ViewMode = 'design' | 'deploy' | 'monitor';

export function EditorPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('design');
    const [topology, setTopology] = useState<TopologyGraph | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateFromSpec = async (spec: Record<string, unknown>) => {
        setIsLoading(true);
        try {
            const result = await generateTopologyFromSpec(spec);
            setTopology(result.topology);
            // Optionally switch to design view if not already
            if (viewMode !== 'design') setViewMode('design');
        } catch (err) {
            console.error('Failed to generate topology:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-[#030712] text-white overflow-hidden selection:bg-indigo-500/30 font-sans">
            {/* Glassmorphic Header */}
            <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 z-50 glass-header bg-[#030712]/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 pr-4 border-r border-white/5">
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                            <Zap className="w-5 h-5 text-white fill-current" />
                        </div>
                        <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 hidden md:block">
                            TopNet
                        </span>
                    </div>

                    {/* Tab Navigation */}
                    <nav className="flex items-center bg-black/20 rounded-lg p-1 border border-white/5">
                        <TabButton
                            active={viewMode === 'design'}
                            onClick={() => setViewMode('design')}
                            icon={<Box className="w-4 h-4" />}
                            label="Design"
                        />
                        <TabButton
                            active={viewMode === 'deploy'}
                            onClick={() => setViewMode('deploy')}
                            icon={<Play className="w-4 h-4" />}
                            label="Deploy"
                        />
                        <TabButton
                            active={viewMode === 'monitor'}
                            onClick={() => setViewMode('monitor')}
                            icon={<LayoutDashboard className="w-4 h-4" />}
                            label="Monitor"
                        />
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    {/* Topology Name Display - Only show if topology exists */}
                    {topology && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full mr-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            <span className="text-xs font-mono text-indigo-300">
                                {topology.nodes.length} Nodes • {topology.edges.length} Links
                            </span>
                        </div>
                    )}

                    <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-sm font-medium transition-all group">
                        <Share2 className="w-4 h-4 text-gray-400 group-hover:text-white" />
                        <span className="hidden sm:block">Share</span>
                    </button>

                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/10 shadow-lg" />
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Persistent Chat Sidebar */}
                <motion.div
                    initial={false}
                    animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="border-r border-white/5 bg-[#050608] flex-shrink-0 relative z-30 overflow-hidden flex flex-col"
                >
                    <div className="w-80 h-full flex flex-col">
                        <ChatPanel
                            onGenerateTopology={handleGenerateFromSpec}
                            isGenerating={isLoading}
                        />
                    </div>
                </motion.div>

                {/* Main Viewport */}
                <div className="flex-1 relative bg-[url('/grid.svg')] bg-repeat opacity-[0.98] overflow-hidden">

                    {/* Design View */}
                    <div className={cn("absolute inset-0 transition-opacity duration-300 flex flex-col", viewMode === 'design' ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none")}>
                        <ReactFlowProvider>
                            <div className="flex-1 h-full w-full">
                                <TopologyCanvas
                                    topology={topology}
                                    onNodeSelect={() => { }}
                                />
                            </div>
                        </ReactFlowProvider>

                        {/* Empty State Overlay */}
                        {!topology && !isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="text-center space-y-4 p-8 rounded-3xl bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/10 shadow-2xl max-w-md animate-in fade-in zoom-in duration-500 pointer-events-auto">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto border border-white/10">
                                        <Zap className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                            Canvas Empty
                                        </h3>
                                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                                            Start by describing your infrastructure in the chat.<br />
                                            Try "Create a VPC with 2 public subnets"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Deploy View */}
                    <div className={cn("absolute inset-0 transition-opacity duration-300 bg-[#030712]", viewMode === 'deploy' ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none")}>
                        {/* Use DeploymentConsole in full view mode */}
                        <DeploymentConsole
                            topology={topology}
                            isOpen={true} // Always "open" in this tab
                            onClose={() => { }} // No close button needed in tab mode
                            viewMode="full"
                        />
                    </div>

                    {/* Monitor View (AWS Dashboard) */}
                    <div className={cn("absolute inset-0 transition-opacity duration-300 bg-[#030712] overflow-hidden flex flex-col", viewMode === 'monitor' ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none")}>
                        <div className="flex-1 w-full p-6 overflow-y-auto custom-scrollbar">
                            <div className="max-w-7xl mx-auto">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                            <LayoutDashboard className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">AWS Monitor</h2>
                                            <p className="text-gray-400 text-sm">Real-time resource tracking and health metrics</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-sm font-medium text-emerald-400">Connected</span>
                                    </div>
                                </div>

                                <AwsDashboard />
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all relative",
                active ? "text-white" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            )}
        >
            {active && (
                <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-indigo-600 rounded-md shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            )}
            <span className="relative z-10 flex items-center gap-2">
                {icon}
                {label}
            </span>
        </button>
    );
}
