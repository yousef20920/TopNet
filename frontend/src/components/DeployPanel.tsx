// src/components/DeployPanel.tsx
// AWS Dashboard and Deployment panel

import { useState, useEffect } from 'react';
import type { TopologyGraph } from '../types/topology';

const API_BASE = 'http://localhost:3001/api';

interface AWSAccountInfo {
  account_id: string | null;
  account_alias: string | null;
  user_name: string | null;
  user_arn: string | null;
  region: string;
}

interface EC2Instance {
  id: string;
  name: string;
  type: string;
  state: string;
  az: string;
}

interface EC2Summary {
  total: number;
  running: number;
  stopped: number;
  instances: EC2Instance[];
}

interface VPC {
  id: string;
  name: string;
  cidr: string;
  is_default: boolean;
  state: string;
}

interface VPCSummary {
  total: number;
  vpcs: VPC[];
}

interface AWSResourceSummary {
  ec2: EC2Summary;
  vpcs: VPCSummary;
  security_groups: number;
  subnets: number;
  load_balancers: number;
  rds_instances: number;
}

interface AWSDashboard {
  connected: boolean;
  account: AWSAccountInfo | null;
  resources: AWSResourceSummary;
  error: string | null;
}

interface AWSRegion {
  code: string;
  name: string;
}

interface DeployPanelProps {
  topology: TopologyGraph | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DeployPanel({ topology, isOpen, onClose }: DeployPanelProps) {
  const [dashboard, setDashboard] = useState<AWSDashboard | null>(null);
  const [regions, setRegions] = useState<AWSRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeploySection, setShowDeploySection] = useState(false);

  // Fetch dashboard data
  const fetchDashboard = async (region: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/aws/dashboard?region=${region}`);
      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      setDashboard({
        connected: false,
        account: null,
        resources: {
          ec2: { total: 0, running: 0, stopped: 0, instances: [] },
          vpcs: { total: 0, vpcs: [] },
          security_groups: 0,
          subnets: 0,
          load_balancers: 0,
          rds_instances: 0,
        },
        error: err instanceof Error ? err.message : 'Failed to fetch AWS data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch regions
  const fetchRegions = async () => {
    try {
      const response = await fetch(`${API_BASE}/aws/regions`);
      const data = await response.json();
      setRegions(data);
    } catch (err) {
      console.error('Failed to fetch regions:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRegions();
      fetchDashboard(selectedRegion);
    }
  }, [isOpen]);

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    fetchDashboard(region);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">☁️</span>
            <h2 className="text-lg font-semibold text-white">AWS Dashboard</h2>
            {dashboard?.connected && (
              <span className="px-2 py-0.5 text-xs rounded bg-green-600 text-white">
                Connected
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Region Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-300">Region:</label>
            <select
              value={selectedRegion}
              onChange={(e) => handleRegionChange(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-600 text-sm"
            >
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchDashboard(selectedRegion)}
              disabled={isLoading}
              className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500"
            >
              {isLoading ? '⟳ Loading...' : '⟳ Refresh'}
            </button>
          </div>

          {/* Error */}
          {dashboard?.error && (
            <div className="p-3 bg-red-900/50 border border-red-500 rounded">
              <p className="text-sm text-red-200">⚠️ {dashboard.error}</p>
            </div>
          )}

          {/* Account Info */}
          {dashboard?.account && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <span>👤</span> Account Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Account ID:</span>
                  <span className="ml-2 text-white font-mono">{dashboard.account.account_id}</span>
                </div>
                {dashboard.account.account_alias && (
                  <div>
                    <span className="text-gray-400">Alias:</span>
                    <span className="ml-2 text-white">{dashboard.account.account_alias}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">User:</span>
                  <span className="ml-2 text-white">{dashboard.account.user_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Region:</span>
                  <span className="ml-2 text-white">{selectedRegion}</span>
                </div>
              </div>
            </div>
          )}

          {/* Resource Summary Cards */}
          {dashboard?.connected && (
            <div className="grid grid-cols-3 gap-4">
              {/* EC2 Card */}
              <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🖥️</span>
                  <span className="text-3xl font-bold text-white">{dashboard.resources.ec2.total}</span>
                </div>
                <h4 className="text-sm font-medium text-white">EC2 Instances</h4>
                <div className="text-xs text-gray-300 mt-1">
                  <span className="text-green-400">{dashboard.resources.ec2.running} running</span>
                  {dashboard.resources.ec2.stopped > 0 && (
                    <span className="text-gray-400 ml-2">{dashboard.resources.ec2.stopped} stopped</span>
                  )}
                </div>
              </div>

              {/* VPC Card */}
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🌐</span>
                  <span className="text-3xl font-bold text-white">{dashboard.resources.vpcs.total}</span>
                </div>
                <h4 className="text-sm font-medium text-white">VPCs</h4>
                <div className="text-xs text-gray-300 mt-1">
                  {dashboard.resources.subnets} subnets
                </div>
              </div>

              {/* Security Groups Card */}
              <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🛡️</span>
                  <span className="text-3xl font-bold text-white">{dashboard.resources.security_groups}</span>
                </div>
                <h4 className="text-sm font-medium text-white">Security Groups</h4>
              </div>

              {/* Load Balancers Card */}
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">⚖️</span>
                  <span className="text-3xl font-bold text-white">{dashboard.resources.load_balancers}</span>
                </div>
                <h4 className="text-sm font-medium text-white">Load Balancers</h4>
              </div>

              {/* RDS Card */}
              <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-800/20 border border-cyan-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🗄️</span>
                  <span className="text-3xl font-bold text-white">{dashboard.resources.rds_instances}</span>
                </div>
                <h4 className="text-sm font-medium text-white">RDS Databases</h4>
              </div>

              {/* Subnets Card */}
              <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-600/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📡</span>
                  <span className="text-3xl font-bold text-white">{dashboard.resources.subnets}</span>
                </div>
                <h4 className="text-sm font-medium text-white">Subnets</h4>
              </div>
            </div>
          )}

          {/* EC2 Instances List */}
          {dashboard?.resources.ec2.instances && dashboard.resources.ec2.instances.length > 0 && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <span>🖥️</span> EC2 Instances
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-600">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Instance ID</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">State</th>
                      <th className="pb-2">AZ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.resources.ec2.instances.map((instance) => (
                      <tr key={instance.id} className="border-b border-gray-700/50">
                        <td className="py-2 text-white">{instance.name || '—'}</td>
                        <td className="py-2 text-gray-300 font-mono text-xs">{instance.id}</td>
                        <td className="py-2 text-gray-300">{instance.type}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            instance.state === 'running' 
                              ? 'bg-green-600/30 text-green-300' 
                              : 'bg-gray-600/30 text-gray-300'
                          }`}>
                            {instance.state}
                          </span>
                        </td>
                        <td className="py-2 text-gray-300">{instance.az}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VPCs List */}
          {dashboard?.resources.vpcs.vpcs && dashboard.resources.vpcs.vpcs.length > 0 && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <span>🌐</span> VPCs
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-600">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">VPC ID</th>
                      <th className="pb-2">CIDR</th>
                      <th className="pb-2">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.resources.vpcs.vpcs.map((vpc) => (
                      <tr key={vpc.id} className="border-b border-gray-700/50">
                        <td className="py-2 text-white">{vpc.name || '—'}</td>
                        <td className="py-2 text-gray-300 font-mono text-xs">{vpc.id}</td>
                        <td className="py-2 text-gray-300 font-mono">{vpc.cidr}</td>
                        <td className="py-2">
                          {vpc.is_default && (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-600/30 text-blue-300">
                              Default
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deploy Section */}
          {showDeploySection && topology && (
            <div className="bg-gray-700/50 rounded-lg p-4 border border-blue-500/50">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <span>🚀</span> Deploy Topology
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                This will deploy the current topology ({topology.nodes.length} resources) to AWS region <strong>{selectedRegion}</strong>.
              </p>
              <div className="bg-yellow-900/30 border border-yellow-600/50 rounded p-3 mb-4">
                <p className="text-sm text-yellow-200">
                  ⚠️ Deployment feature is coming soon. Terraform generation needs to be fixed first.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {dashboard?.connected 
              ? `Connected to AWS account ${dashboard.account?.account_id}`
              : 'Not connected'}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
            
            {dashboard?.connected && topology && (
              <button
                onClick={() => setShowDeploySection(!showDeploySection)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                {showDeploySection ? '📋 Hide Deploy' : '🚀 Deploy Topology'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
