import React from 'react';
import {
    Server,
    ShieldCheck,
    Package,
    Play,
    CheckCircle2,
    Loader2,
    AlertTriangle,
    DollarSign,
    Rocket,
    Trash2,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Stage, PlanSummary } from '../types/deployment';
import { GettingStartedGuide } from './GettingStartedGuide';
import type { TopologyGraph } from '../types/topology';

interface DeploymentControlProps {
    stage: Stage;
    deploymentId: string | null;
    planSummary: PlanSummary | null;
    topology: TopologyGraph | null;
    isOpen: boolean;
    onClose: () => void;
    onPlan: () => void;
    onConfirmDeploy: () => void;
    onCancel: () => void;
    onShowDestroyConfirm: () => void;
    viewMode?: 'overlay' | 'full';
}

export function DeploymentControl({
    stage,
    deploymentId,
    planSummary,
    topology,
    isOpen,
    onClose,
    onPlan,
    onConfirmDeploy,
    onCancel,
    onShowDestroyConfirm,
    viewMode = 'overlay'
}: DeploymentControlProps) {
    if (!isOpen) return null;

    return (
        <div className={cn(
            "h-full flex flex-col bg-[#0c0c0e]/95 backdrop-blur transition-all duration-300",
            viewMode === 'full' ? "w-full max-w-5xl mx-auto border-x border-white/10" : "w-[400px] border-l border-white/10 absolute right-0 top-0 bottom-0 z-30 shadow-2xl"
        )}>
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-indigo-400" />
                        <span className="font-semibold text-sm text-gray-200">Deployment Control</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <div className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border",
                        stage === 'idle' && "bg-gray-800 text-gray-400 border-gray-700",
                        stage === 'review' && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                        stage === 'complete' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        stage === 'failed' && "bg-red-500/10 text-red-400 border-red-500/20",
                        !['idle', 'review', 'complete', 'failed'].includes(stage) && "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                    )}>
                        {stage === 'review' ? 'Review' : stage}
                    </div>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                <div className="p-6">
                    {/* Deployment ID Display */}
                    {deploymentId && (
                        <div className="mb-6 flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                            <span className="text-xs text-gray-500 uppercase tracking-wider">Deployment ID</span>
                            <code className="text-xs font-mono text-indigo-300">{deploymentId.slice(0, 8)}</code>
                        </div>
                    )}

                    {/* Status Header - Simplified */}
                    <div className="mb-6">
                        <h2 className="text-base font-semibold text-white mb-4">Deployment Pipeline</h2>

                        {/* Compact Pipeline Visualizer */}
                        <div className="flex items-center justify-between relative px-2">
                            {/* Connecting Line */}
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -z-10" />

                            {['plan', 'review', 'apply', 'complete'].map((s, idx) => {
                                const steps = ['plan', 'review', 'apply', 'complete'];
                                const currentIdx = steps.indexOf(stage === 'connect' ? 'plan' : (stage === 'failed' ? 'plan' : stage));
                                const stepIdx = idx;
                                const isCompleted = currentIdx > stepIdx || stage === 'complete';
                                const isCurrent = currentIdx === stepIdx;

                                return (
                                    <div key={s} className="flex flex-col items-center gap-1.5 bg-[#0c0c0e] px-2">
                                        <div className={cn(
                                            "w-2.5 h-2.5 rounded-full transition-all",
                                            isCompleted ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                                                isCurrent ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse" :
                                                    "bg-gray-800"
                                        )} />
                                        <span className={cn(
                                            "text-[10px] font-medium uppercase tracking-wider transition-colors",
                                            isCompleted ? "text-emerald-400" :
                                                isCurrent ? "text-indigo-400" : "text-gray-600"
                                        )}>{s}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Review Panel */}
                    {stage === 'review' && planSummary && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-4 rounded-xl bg-yellow-950/20 border border-yellow-500/20 mb-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <AlertTriangle className="w-12 h-12 text-yellow-500" />
                                </div>

                                <h3 className="text-sm font-semibold text-yellow-500 mb-4 flex items-center gap-2">
                                    Deployment Summary
                                </h3>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-yellow-500/10 text-yellow-500">
                                                <Package className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400">Resources</span>
                                                <span className="text-lg font-bold text-white">{planSummary.resourceCount}</span>
                                            </div>
                                        </div>
                                        <div className="h-8 w-[1px] bg-white/10" />
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-green-500/10 text-green-500">
                                                <DollarSign className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400">Est. Monthly</span>
                                                <span className="text-lg font-bold text-white">${planSummary.estimatedCost.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {planSummary.resourceList.length > 0 && (
                                        <div>
                                            <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Changes</div>
                                            <div className="bg-black/20 rounded-lg p-2 border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                                                {planSummary.resourceList.map((r, i) => (
                                                    <div key={i} className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                        <span className="text-xs text-gray-300 font-mono">{r}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success / Getting Started */}
                    {stage === 'complete' && topology && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mb-6">
                            <GettingStartedGuide
                                region={topology?.nodes[0]?.region || 'us-east-2'}
                                topology={topology}
                            />
                        </div>
                    )}

                    {/* Error State */}
                    {stage === 'failed' && (
                        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 mb-6 animate-in fade-in">
                            <div className="flex items-center gap-3 text-red-400 mb-2">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-semibold">Deployment Failed</span>
                            </div>
                            <p className="text-sm text-red-200/80">
                                Check the terminal output below for detailed error messages.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 bg-[#0c0c0e] border-t border-white/10 backdrop-blur-xl">
                {stage === 'idle' || stage === 'failed' ? (
                    <button
                        onClick={onPlan}
                        disabled={!topology}
                        className="w-full group relative overflow-hidden py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        <Play className="w-4 h-4 fill-current" />
                        {stage === 'idle' ? 'Start Deployment Plan' : 'Retry Deployment'}
                    </button>
                ) : stage === 'review' ? (
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-medium text-sm transition-all border border-white/5 hover:border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirmDeploy}
                            className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                        >
                            <Rocket className="w-4 h-4" />
                            Confirm & Deploy
                        </button>
                    </div>
                ) : stage === 'complete' ? (
                    <div className="space-y-3">
                        <button
                            onClick={onPlan}
                            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
                        >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Redeploy / Update
                        </button>
                        <button
                            onClick={onShowDestroyConfirm}
                            className="w-full py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Destroy Infrastructure
                        </button>
                    </div>
                ) : (
                    <button
                        disabled
                        className="w-full py-3 bg-gray-900 border border-white/5 text-gray-500 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-wait"
                    >
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        {stage === 'plan' ? 'Generating Plan...' : stage === 'apply' ? 'Deploying Resources...' : 'Processing...'}
                    </button>
                )}
            </div>
        </div>
    );
}

function StepItem({ title, description, status, icon }: { title: string, description: string, status: 'pending' | 'active' | 'completed' | 'failed', icon: React.ReactNode }) {
    return (
        <div className="flex gap-4 relative z-10">
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 border-2",
                status === 'pending' && "bg-[#0c0c0e] border-gray-800 text-gray-600",
                status === 'active' && "bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110",
                status === 'completed' && "bg-[#0c0c0e] border-emerald-500/50 text-emerald-400",
                status === 'failed' && "bg-[#0c0c0e] border-red-500/50 text-red-400"
            )}>
                {status === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            </div>
            <div className="flex flex-col pt-0.5">
                <span className={cn(
                    "text-sm font-semibold transition-colors",
                    status === 'pending' && "text-gray-500",
                    status === 'active' && "text-white",
                    status === 'completed' && "text-emerald-400",
                    status === 'failed' && "text-red-400"
                )}>{title}</span>
                <span className="text-[10px] text-gray-500">{description}</span>
            </div>
        </div>
    );
}

function getStepStatus(currentStep: Stage, pipelineStage: Stage): 'pending' | 'active' | 'completed' | 'failed' {
    const order: Stage[] = ['connect', 'plan', 'review', 'apply', 'verify'];
    const currentIndex = order.indexOf(currentStep);
    const pipelineIndex = order.indexOf(pipelineStage);

    if (pipelineStage === 'failed') return 'failed';
    if (pipelineStage === 'complete') return 'completed';
    if (pipelineStage === 'idle' || pipelineStage === 'destroying') return 'pending';

    if (pipelineIndex > currentIndex) return 'completed';
    if (pipelineIndex === currentIndex) return 'active';
    return 'pending';
}
