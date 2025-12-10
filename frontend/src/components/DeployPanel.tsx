// src/components/DeployPanel.tsx
// Deployment panel with plan, apply, and destroy controls

import { useState, useEffect } from 'react';
import type { TopologyGraph } from '../types/topology';
import {
  checkDeployPrerequisites,
  planDeployment,
  applyDeployment,
  destroyDeployment,
  type DeploymentPrerequisites,
  type DeploymentStatus,
  type PlanResponse,
} from '../api/deployApi';

interface DeployPanelProps {
  topology: TopologyGraph | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<DeploymentStatus, string> = {
  pending: 'bg-yellow-500',
  initializing: 'bg-blue-500',
  planning: 'bg-blue-500',
  applying: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  destroyed: 'bg-gray-500',
};

export function DeployPanel({ topology, isOpen, onClose }: DeployPanelProps) {
  const [prerequisites, setPrerequisites] = useState<DeploymentPrerequisites | null>(null);
  const [planResult, setPlanResult] = useState<PlanResponse | null>(null);
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Check prerequisites when panel opens
  useEffect(() => {
    if (isOpen) {
      checkDeployPrerequisites()
        .then(setPrerequisites)
        .catch((err) => setError(err.message));
    }
  }, [isOpen]);

  const handlePlan = async () => {
    if (!topology) return;
    
    setIsLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const result = await planDeployment(topology);
      setPlanResult(result);
      setStatus(result.status);
      setMessage('Plan generated successfully. Review and click Apply to deploy.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planning failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!planResult) return;
    
    setIsLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const result = await applyDeployment(planResult.deployment_id);
      setStatus(result.status);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStatus('failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDestroy = async () => {
    if (!planResult) return;
    
    if (!confirm('Are you sure you want to destroy all deployed resources? This action cannot be undone.')) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const result = await destroyDeployment(planResult.deployment_id);
      setStatus(result.status);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Destroy failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[800px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">🚀 Deploy to AWS</h2>
            {status && (
              <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[status]} text-white`}>
                {status.toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Prerequisites check */}
          {prerequisites && (
            <div className={`p-3 rounded border ${
              prerequisites.ready 
                ? 'bg-green-900/30 border-green-600' 
                : 'bg-red-900/30 border-red-600'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span>{prerequisites.ready ? '✅' : '❌'}</span>
                <span className="font-medium text-white">Prerequisites</span>
              </div>
              <div className="text-sm space-y-1 text-gray-300">
                <div className="flex items-center gap-2">
                  <span>{prerequisites.terraform_installed ? '✓' : '✗'}</span>
                  <span>Terraform CLI installed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{prerequisites.aws_credentials_configured ? '✓' : '✗'}</span>
                  <span>AWS credentials configured</span>
                </div>
              </div>
              {!prerequisites.ready && (
                <p className="text-sm text-red-300 mt-2">{prerequisites.message}</p>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-500 rounded">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Success message */}
          {message && !error && (
            <div className="p-3 bg-blue-900/50 border border-blue-500 rounded">
              <p className="text-sm text-blue-200">{message}</p>
            </div>
          )}

          {/* Plan output */}
          {planResult?.plan_output && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-300">Terraform Plan</h3>
              <pre className="text-xs bg-gray-900 p-3 rounded overflow-auto max-h-64 text-gray-300 font-mono whitespace-pre-wrap">
                {planResult.plan_output}
              </pre>
            </div>
          )}

          {/* Terraform files preview */}
          {planResult?.terraform_files && planResult.terraform_files.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-300">Generated Terraform</h3>
              <pre className="text-xs bg-gray-900 p-3 rounded overflow-auto max-h-48 text-gray-300 font-mono">
                {planResult.terraform_files[0].content}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <div className="flex gap-2">
            {status === 'completed' && (
              <button
                onClick={handleDestroy}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium"
              >
                {isLoading ? 'Destroying...' : '🗑️ Destroy'}
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
            
            {!planResult && (
              <button
                onClick={handlePlan}
                disabled={isLoading || !topology || !prerequisites?.ready}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
              >
                {isLoading ? 'Planning...' : '📋 Plan'}
              </button>
            )}
            
            {planResult && status === 'pending' && (
              <button
                onClick={handleApply}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium"
              >
                {isLoading ? 'Deploying...' : '🚀 Apply'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
