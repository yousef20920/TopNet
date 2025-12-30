import { useState } from 'react';
import type { TopologyGraph } from '../types/topology';
import type { Stage, LogEntry, PlanSummary } from '../types/deployment';
import { LogPanel } from './LogPanel';
import { DeploymentControl } from './DeploymentControl';
import { cn } from '../lib/utils';

interface DeploymentConsoleProps {
    topology: TopologyGraph | null;
    isOpen: boolean;
    onClose: () => void;
    viewMode?: 'overlay' | 'full';
}


const API_BASE = 'http://localhost:3001';

export function DeploymentConsole({ topology, isOpen, onClose, viewMode = 'overlay' }: DeploymentConsoleProps) {
    const [stage, setStage] = useState<Stage>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [deploymentId, setDeploymentId] = useState<string | null>(null);
    const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
    const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
    const [isLogExpanded, setIsLogExpanded] = useState(true);

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        setLogs(prev => [...prev, {
            id: Math.random().toString(36),
            timestamp: new Date().toLocaleTimeString(),
            message,
            type
        }]);
    };

    // Step 1: Plan only
    const handlePlan = async () => {
        if (!topology) {
            addLog('No topology to deploy', 'error');
            return;
        }

        setStage('connect');
        setLogs([]);
        setPlanSummary(null);
        setIsLogExpanded(true);
        addLog('Initializing deployment sequence...', 'info');

        try {
            setStage('plan');
            addLog('Generating Terraform plan...', 'info');

            const planRes = await fetch(`${API_BASE}/api/deploy/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topology })
            });

            if (!planRes.ok) {
                const error = await planRes.json();
                throw new Error(error.detail || 'Plan failed');
            }

            const planData = await planRes.json();
            setDeploymentId(planData.deployment_id);

            // Parse plan output to extract resource information
            const planOutput = planData.plan_output || '';
            const resourceMatches = planOutput.match(/# (aws_\w+\.\w+) will be created/g) || [];
            const resourceList = resourceMatches.map((m: string) => m.replace('# ', '').replace(' will be created', ''));
            const resourceCount = resourceList.length;

            // Log the plan
            addLog('─── Terraform Plan ───', 'info');
            const lines = planOutput.split('\n');
            lines.forEach((line: string) => {
                if (line.trim()) {
                    if (line.includes('will be created') || line.includes('+ create')) {
                        addLog(line, 'success');
                    } else if (line.includes('Error')) {
                        addLog(line, 'error');
                    } else {
                        addLog(line, 'info');
                    }
                }
            });

            if (planData.status === 'failed') {
                setStage('failed');
                addLog('✗ Plan failed. Check logs above.', 'error');
                return;
            }

            // Get cost estimate from topology
            const estimatedCost = (topology as any).cost_estimate?.monthly_total ||
                resourceCount * 7.5; // Rough estimate if no cost data

            // Set plan summary for review
            setPlanSummary({
                resourceCount,
                resourceList,
                estimatedCost
            });

            // Move to review stage
            setStage('review');
            setIsLogExpanded(false); // Collapse logs for clearer review
            addLog('✓ Plan complete!', 'success');
            addLog(`📊 ${resourceCount} AWS resources will be created`, 'info');
            addLog(`💰 Estimated cost: ~$${estimatedCost.toFixed(2)}/month`, 'warning');
            addLog('─────────────────────────', 'info');
            addLog('⚠️  Review the plan in the Deployment Pipeline, then click "Confirm & Deploy" to proceed.', 'warning');

        } catch (err) {
            setStage('failed');
            addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        }
    };

    // Step 2: Apply (after user confirms)
    const handleConfirmDeploy = async () => {
        if (!deploymentId) {
            addLog('No deployment to confirm', 'error');
            return;
        }

        try {
            setStage('apply');
            setIsLogExpanded(true);
            addLog('─────────────────────────', 'info');
            addLog('🚀 User confirmed. Running terraform apply...', 'warning');
            addLog('⚠️  Creating REAL AWS resources in your account...', 'warning');

            const applyRes = await fetch(`${API_BASE}/api/deploy/apply/${deploymentId}`, {
                method: 'POST'
            });

            if (!applyRes.ok) {
                const error = await applyRes.json();
                throw new Error(error.detail || 'Apply failed');
            }

            const applyData = await applyRes.json();

            // Show apply output
            if (applyData.apply_output) {
                addLog('─── Terraform Apply ───', 'info');
                const lines = applyData.apply_output.split('\n');
                lines.forEach((line: string) => {
                    if (line.trim()) {
                        if (line.includes('Creating') || line.includes('created')) {
                            addLog(line, 'success');
                        } else if (line.includes('Error')) {
                            addLog(line, 'error');
                        } else {
                            addLog(line, 'info');
                        }
                    }
                });
            }

            if (applyData.status === 'completed') {
                setStage('complete');
                setIsLogExpanded(false);
                addLog('─────────────────────────', 'info');
                addLog('✓ ✓ Deployment completed successfully! 🚀', 'success');
                addLog('✓ Resources are now live in your AWS account.', 'success');
                addLog(`Deployment ID: ${deploymentId}`, 'info');
            } else {
                setStage('failed');
                addLog('✗ Deployment failed.', 'error');
                if (applyData.error) {
                    addLog(`Error: ${applyData.error}`, 'error');
                }
            }

        } catch (err) {
            setStage('failed');
            addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        }
    };

    const handleDestroy = async () => {
        if (!deploymentId) {
            addLog('No deployment to destroy', 'error');
            return;
        }

        setShowDestroyConfirm(false);
        setStage('destroying');
        setIsLogExpanded(true);
        addLog('Destroying infrastructure...', 'warning');

        try {
            const res = await fetch(`${API_BASE}/api/deploy/destroy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deployment_id: deploymentId })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Destroy failed');
            }

            const data = await res.json();

            if (data.status === 'destroyed') {
                setStage('idle');
                addLog('✓ Infrastructure destroyed successfully', 'success');
                addLog('All AWS resources have been removed.', 'info');
                setDeploymentId(null);
                setPlanSummary(null);
            } else {
                setStage('failed');
                addLog('Failed to destroy infrastructure', 'error');
            }

        } catch (err) {
            setStage('failed');
            addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Split Layout: Log Panel (Bottom) and Control Panel (Right) */}

            {/* Bottom Log Panel */}
            <LogPanel
                logs={logs}
                isOpen={true} // Always mounted if console is open
                isExpanded={isLogExpanded}
                onToggleExpand={() => setIsLogExpanded(!isLogExpanded)}
                onClose={onClose}
                style={{ right: viewMode === 'full' ? '0' : '400px' }}
            />

            {/* Right Control Panel */}
            <div className={cn(
                "h-full bg-[#0c0c0e]/95 backdrop-blur flex flex-col shadow-2xl transition-all duration-300",
                viewMode === 'full' ? "w-full border-none" : "w-[400px] border-l border-white/10 absolute right-0 top-0 bottom-0 z-30"
            )}
                style={{
                    paddingBottom: viewMode === 'full' ? (isLogExpanded ? '300px' : '40px') : '0'
                }}>
                <DeploymentControl
                    stage={stage}
                    deploymentId={deploymentId}
                    planSummary={planSummary}
                    topology={topology}
                    isOpen={isOpen}
                    onClose={onClose}
                    onPlan={handlePlan}
                    onConfirmDeploy={handleConfirmDeploy}
                    onCancel={() => { setStage('idle'); setLogs([]); setPlanSummary(null); }}
                    onShowDestroyConfirm={() => setShowDestroyConfirm(true)}
                    viewMode={viewMode}
                />
            </div>
            {/* Destroy Confirmation Modal handled internally by Control or separate? 
                Actually DeploymentControl handles show logic, but modal should probably be global or inside Control.
                Let's move modal inside DeploymentControl for cleaner DOM usage or keep it here if it needs to overlay everything.
            */}
            {showDestroyConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
                    <div className="bg-[#0c0c0e] border border-red-500/30 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-full bg-red-900/20">
                                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-white">Destroy Infrastructure?</h3>
                        </div>
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                            This will permanently delete all AWS resources created by this deployment.<br />
                            <span className="text-red-400 font-medium">This action cannot be undone.</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDestroyConfirm(false)}
                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium text-sm transition-colors border border-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDestroy}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-red-500/20"
                            >
                                Confirm Destroy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
