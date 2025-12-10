import { useState, useEffect, useRef } from 'react';
import {
    Terminal,
    CheckCircle2,
    Loader2,
    Play,
    Ban,
    ShieldCheck,
    Server,
    LayoutDashboard,
    Rocket,
    X
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { TopologyGraph } from '../types/topology';
import { AwsDashboard } from './AwsDashboard';

interface DeploymentConsoleProps {
    topology: TopologyGraph | null;
    isOpen: boolean;
    onClose: () => void;
}

type Stage = 'idle' | 'connect' | 'plan' | 'apply' | 'verify' | 'complete' | 'failed';
type Tab = 'deploy' | 'dashboard';

interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

export function DeploymentConsole({ topology, isOpen, onClose }: DeploymentConsoleProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('deploy');
    const [stage, setStage] = useState<Stage>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        setLogs(prev => [...prev, {
            id: Math.random().toString(36),
            timestamp: new Date().toLocaleTimeString(),
            message,
            type
        }]);
    };

    const handleDeploy = async () => {
        setStage('connect');
        setLogs([]);
        addLog('Initializing deployment sequence...', 'info');

        // MOCK Deployment Process
        setTimeout(() => {
            setStage('plan');
            addLog('Authenticating with AWS...', 'info');
            addLog('Connected to account: 123456789012 (us-east-1)', 'success');

            setTimeout(() => {
                addLog('Generating Terraform plan...', 'info');
                addLog('Plan: 5 to add, 0 to change, 0 to destroy.', 'info');

                // Wait for user confirmation (simulated here for now)
                setTimeout(() => {
                    setStage('apply');
                    addLog('Applying changes...', 'warning');
                    addLog('Creating aws_vpc.main...', 'info');
                    addLog('Creating aws_subnet.public_1...', 'info');
                    addLog('Creating aws_subnet.private_1...', 'info');
                    addLog('Creating aws_instance.web_server...', 'info');

                    setTimeout(() => {
                        setStage('verify');
                        addLog('Verifying resources...', 'info');
                        addLog('Health check passed for web_server', 'success');

                        setTimeout(() => {
                            setStage('complete');
                            addLog('Deployment completed successfully! 🚀', 'success');
                        }, 1000);
                    }, 2000);
                }, 2000);
            }, 1500);
        }, 1000);
    };

    if (!isOpen) return null;

    return (
        <div className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e] border-t border-white/10 transition-all duration-300 shadow-2xl flex flex-col",
            isExpanded ? "h-[500px]" : "h-12"
        )}>
            {/* Header Bar */}
            <div
                className="h-12 flex items-center justify-between px-4 bg-white/5 border-b border-white/5"
            >
                <div
                    className="flex items-center gap-4 cursor-pointer"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-indigo-400" />
                        <span className="font-semibold text-sm">Deployment Console</span>
                    </div>

                    {/* Status Badge */}
                    <div className={cn(
                        "px-2 py-0.5 rounded text-xs font-mono border",
                        stage === 'idle' && "bg-gray-800 text-gray-400 border-gray-700",
                        stage === 'complete' && "bg-green-900/30 text-green-400 border-green-800",
                        stage === 'failed' && "bg-red-900/30 text-red-400 border-red-800",
                        (stage !== 'idle' && stage !== 'complete' && stage !== 'failed') && "bg-blue-900/30 text-blue-400 border-blue-800 animate-pulse"
                    )}>
                        {stage.toUpperCase()}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Tabs */}
                    <div className="flex bg-black/50 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setActiveTab('deploy')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all",
                                activeTab === 'deploy'
                                    ? "bg-indigo-600 text-white shadow-lg"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Rocket className="w-3 h-3" />
                            Deploy
                        </button>
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all",
                                activeTab === 'dashboard'
                                    ? "bg-indigo-600 text-white shadow-lg"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <LayoutDashboard className="w-3 h-3" />
                            AWS Status
                        </button>
                    </div>

                    <div className="h-4 w-[1px] bg-white/10" />

                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'dashboard' ? (
                    <div className="w-full h-full bg-[#030304]">
                        <AwsDashboard />
                    </div>
                ) : (
                    <>
                        {/* Left: Pipeline Visualizer */}
                        <div className="w-64 border-r border-white/5 bg-[#09090b] p-6 flex flex-col gap-6">
                            <Step
                                title="Connect"
                                status={getStepStatus('connect', stage)}
                                icon={<Server className="w-4 h-4" />}
                            />
                            <div className="w-0.5 h-4 bg-white/5 ml-4 -my-2" />
                            <Step
                                title="Plan"
                                status={getStepStatus('plan', stage)}
                                icon={<ShieldCheck className="w-4 h-4" />}
                            />
                            <div className="w-0.5 h-4 bg-white/5 ml-4 -my-2" />
                            <Step
                                title="Apply"
                                status={getStepStatus('apply', stage)}
                                icon={<Play className="w-4 h-4" />}
                            />
                            <div className="w-0.5 h-4 bg-white/5 ml-4 -my-2" />
                            <Step
                                title="Verify"
                                status={getStepStatus('verify', stage)}
                                icon={<CheckCircle2 className="w-4 h-4" />}
                            />
                        </div>

                        {/* Center: Logs */}
                        <div className="flex-1 bg-black font-mono text-xs p-4 overflow-y-auto custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 opacity-50">
                                    <Terminal className="w-8 h-8" />
                                    <p>Ready to deploy. Logs will appear here.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {logs.map((log) => (
                                        <div key={log.id} className="flex gap-3 font-mono">
                                            <span className="text-gray-500 w-16 shrink-0">{log.timestamp}</span>
                                            <span className={cn(
                                                "flex-1",
                                                log.type === 'info' && "text-gray-300",
                                                log.type === 'success' && "text-green-400",
                                                log.type === 'warning' && "text-yellow-400",
                                                log.type === 'error' && "text-red-400"
                                            )}>
                                                {log.type === 'success' && '✓ '}
                                                {log.type === 'error' && '✗ '}
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                    <div ref={logsEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Right: Actions & Summary */}
                        <div className="w-72 border-l border-white/5 bg-[#09090b] p-4 flex flex-col">
                            <div className="mb-6">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Target</h3>
                                <div className="p-3 rounded bg-white/5 border border-white/5 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Region</span>
                                        <span className="text-white font-mono">us-east-1</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Resources</span>
                                        <span className="text-white font-mono">{topology?.nodes.length || 0}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto space-y-2">
                                {stage === 'idle' || stage === 'complete' || stage === 'failed' ? (
                                    <button
                                        onClick={handleDeploy}
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        {stage === 'idle' ? 'Start Deployment' : 'Redeploy'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setStage('failed')} // Mock cancel
                                        className="w-full py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-900/50 rounded font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Ban className="w-4 h-4" />
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Step({ title, status, icon }: { title: string, status: 'pending' | 'active' | 'completed' | 'failed', icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <div className={cn(
                "w-8 h-8 rounded flex items-center justify-center transition-all",
                status === 'pending' && "bg-white/5 text-gray-600",
                status === 'active' && "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]",
                status === 'completed' && "bg-green-500/20 text-green-400 border border-green-500/30",
                status === 'failed' && "bg-red-500/20 text-red-400 border border-red-500/30"
            )}>
                {status === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            </div>
            <div className="flex flex-col">
                <span className={cn(
                    "text-sm font-medium transition-colors",
                    status === 'pending' && "text-gray-500",
                    status === 'active' && "text-white",
                    status === 'completed' && "text-green-400",
                    status === 'failed' && "text-red-400"
                )}>{title}</span>
            </div>
        </div>
    );
}

function getStepStatus(currentStep: Stage, pipelineStage: Stage): 'pending' | 'active' | 'completed' | 'failed' {
    const order: Stage[] = ['connect', 'plan', 'apply', 'verify'];
    const currentIndex = order.indexOf(currentStep);
    const pipelineIndex = order.indexOf(pipelineStage);

    if (pipelineStage === 'failed') return 'failed';
    if (pipelineStage === 'complete') return 'completed';
    if (pipelineStage === 'idle') return 'pending';

    if (pipelineIndex > currentIndex) return 'completed';
    if (pipelineIndex === currentIndex) return 'active';
    return 'pending';
}
