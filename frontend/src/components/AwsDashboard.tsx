import { useState, useEffect } from 'react';
import {
    Server,
    Shield,
    Globe,
    Database,
    Network,
    RefreshCw,
    AlertTriangle,
    User
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_BASE = 'http://localhost:3001/api';

interface AWSAccountInfo {
    account_id: string | null;
    account_alias: string | null;
    user_name: string | null;
    user_arn: string | null;
    region: string;
}

interface AWSResourceSummary {
    ec2: { total: number; running: number; stopped: number };
    vpcs: { total: number };
    security_groups: number;
    subnets: number;
    load_balancers: number;
    rds_instances: number;
}

interface AWSDashboardData {
    connected: boolean;
    account: AWSAccountInfo | null;
    resources: AWSResourceSummary;
    error: string | null;
}

export function AwsDashboard() {
    const [data, setData] = useState<AWSDashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [region] = useState('us-east-1'); // Could be made selectable later

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/aws/dashboard?region=${region}`);
            const result = await response.json();
            setData(result);
        } catch (err) {
            setData({
                connected: false,
                account: null,
                resources: {
                    ec2: { total: 0, running: 0, stopped: 0 },
                    vpcs: { total: 0 },
                    security_groups: 0,
                    subnets: 0,
                    load_balancers: 0,
                    rds_instances: 0,
                },
                error: err instanceof Error ? err.message : 'Failed to fetch data',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [region]);

    if (!data && isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading info...
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="h-full overflow-y-auto px-6 py-6 custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">AWS Account Status</h2>
                    <p className="text-sm text-gray-400">
                        {data.connected
                            ? `Connected to ${data.account?.account_alias || data.account?.account_id}`
                            : 'Not connected'}
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={cn("w-4 h-4 text-gray-400", isLoading && "animate-spin")} />
                </button>
            </div>

            {data.error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <p className="text-sm text-red-200">{data.error}</p>
                </div>
            )}

            {/* Account Info Card */}
            {data.account && (
                <div className="mb-8 p-4 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl">
                    <h3 className="text-sm font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> Identity
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Account ID</span>
                            <span className="font-mono text-white">{data.account.account_id}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">User</span>
                            <span className="text-white">{data.account.user_name}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Region</span>
                            <span className="text-white">{data.account.region}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Alias</span>
                            <span className="text-white">{data.account.account_alias || '-'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Resources Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <ResourceCard
                    icon={<Server className="w-5 h-5 text-orange-400" />}
                    label="EC2 Instances"
                    count={data.resources.ec2.total}
                    subtext={`${data.resources.ec2.running} running`}
                    color="orange"
                />
                <ResourceCard
                    icon={<Globe className="w-5 h-5 text-blue-400" />}
                    label="VPCs"
                    count={data.resources.vpcs.total}
                    subtext={`${data.resources.subnets} subnets`}
                    color="blue"
                />
                <ResourceCard
                    icon={<Shield className="w-5 h-5 text-green-400" />}
                    label="Security Groups"
                    count={data.resources.security_groups}
                    color="green"
                />
                <ResourceCard
                    icon={<Network className="w-5 h-5 text-purple-400" />}
                    label="Load Balancers"
                    count={data.resources.load_balancers}
                    color="purple"
                />
                <ResourceCard
                    icon={<Database className="w-5 h-5 text-cyan-400" />}
                    label="RDS Instances"
                    count={data.resources.rds_instances}
                    color="cyan"
                />
            </div>
        </div>
    );
}

function ResourceCard({ icon, label, count, subtext, color }: { icon: React.ReactNode, label: string, count: number, subtext?: string, color: string }) {
    return (
        <div className={cn(
            "p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors",
            "hover:scale-[1.02] duration-200"
        )}>
            <div className="flex items-start justify-between mb-2">
                <div className={cn("p-2 rounded-lg bg-black/30", `text-${color}-400`)}>
                    {icon}
                </div>
                <span className="text-2xl font-bold text-white">{count}</span>
            </div>
            <div className="text-sm font-medium text-gray-300">{label}</div>
            {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
        </div>
    );
}
