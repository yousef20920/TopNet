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

interface EC2Instance {
    id: string;
    name: string;
    type: string;
    state: string;
    az: string;
}

interface VPCInfo {
    id: string;
    name: string;
    cidr: string;
    is_default: boolean;
    state: string;
}

interface AWSResourceSummary {
    ec2: { total: number; running: number; stopped: number; instances: EC2Instance[] };
    vpcs: { total: number; vpcs: VPCInfo[] };
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
    const [region] = useState('us-east-2'); // Ohio - matches deployment region

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
                    ec2: { total: 0, running: 0, stopped: 0, instances: [] },
                    vpcs: { total: 0, vpcs: [] },
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
                <div className="mb-8 p-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <User className="w-24 h-24 text-indigo-400" />
                    </div>

                    <h3 className="text-sm font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                        <div className="p-1 rounded bg-indigo-500/20">
                            <User className="w-4 h-4" />
                        </div>
                        Identity
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm relative z-10">
                        <div>
                            <span className="block text-indigo-200/60 text-xs uppercase tracking-wider mb-1">Account ID</span>
                            <span className="font-mono text-white text-lg font-medium">{data.account.account_id}</span>
                        </div>
                        <div>
                            <span className="block text-indigo-200/60 text-xs uppercase tracking-wider mb-1">User</span>
                            <span className="text-white font-medium">{data.account.user_name}</span>
                        </div>
                        <div>
                            <span className="block text-indigo-200/60 text-xs uppercase tracking-wider mb-1">Region</span>
                            <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-xs">{data.account.region}</span>
                        </div>
                        <div>
                            <span className="block text-indigo-200/60 text-xs uppercase tracking-wider mb-1">Alias</span>
                            <span className="text-white font-medium">{data.account.account_alias || '-'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Resources Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                    icon={<Shield className="w-5 h-5 text-emerald-400" />}
                    label="Security Groups"
                    count={data.resources.security_groups}
                    color="emerald"
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

            {/* ... Resource Details ... */}
            {/* EC2 Instance Details */}
            {data.resources.ec2.instances && data.resources.ec2.instances.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        EC2 Instances <span className="text-gray-500 font-normal text-xs px-2 py-0.5 bg-white/5 rounded-full">Active</span>
                    </h3>
                    <div className="space-y-3">
                        {data.resources.ec2.instances.map((instance: any) => (
                            <div
                                key={instance.id}
                                onClick={() => window.open(`https://${region}.console.aws.amazon.com/ec2/home?region=${region}#InstanceDetails:instanceId=${instance.id}`, '_blank')} className="group p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-black/40 rounded-lg">
                                            <Server className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-white block">{instance.name || instance.id}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{instance.id}</span>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
                                        instance.state === 'running' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                        instance.state === 'stopped' && "bg-gray-700/50 text-gray-400 border border-gray-600/50",
                                        instance.state === 'pending' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                    )}>
                                        <span className={cn("w-1.5 h-1.5 rounded-full",
                                            instance.state === 'running' ? "bg-emerald-400" :
                                                instance.state === 'stopped' ? "bg-gray-400" : "bg-yellow-400"
                                        )} />
                                        {instance.state}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3 ml-[52px]">
                                    <div>
                                        <span className="text-gray-500 text-xs">Type</span>
                                        <span className="ml-2 text-gray-300 font-mono text-xs group-hover:text-white transition-colors">{instance.type}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">Zone</span>
                                        <span className="ml-2 text-gray-300 font-mono text-xs group-hover:text-white transition-colors">{instance.az}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Keep VPC details similar or reuse same styling */}
            {/* VPC Details */}
            {data.resources.vpcs.vpcs && data.resources.vpcs.vpcs.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">VPCs</h3>
                    <div className="space-y-3">
                        {data.resources.vpcs.vpcs.map((vpc: any) => (
                            <div
                                key={vpc.id}
                                onClick={() => window.open(`https://${region}.console.aws.amazon.com/vpc/home?region=${region}#VpcDetails:VpcId=${vpc.id}`, '_blank')} className="group p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-black/40 rounded-lg">
                                            <Globe className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-white block">{vpc.name || 'Unnamed VPC'}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{vpc.id}</span>
                                        </div>
                                    </div>
                                    {vpc.is_default && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            Default
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3 ml-[52px]">
                                    <div>
                                        <span className="text-gray-500 text-xs">CIDR</span>
                                        <span className="ml-2 text-gray-300 font-mono text-xs group-hover:text-white transition-colors">{vpc.cidr}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">State</span>
                                        <span className="ml-2 text-gray-300 text-xs group-hover:text-white transition-colors">{vpc.state}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ResourceCard({ icon, label, count, subtext, color }: { icon: React.ReactNode, label: string, count: number, subtext?: string, color: string }) {
    return (
        <div className={cn(
            "p-5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-300 group cursor-default",
            "hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/20"
        )}>
            <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2.5 rounded-xl bg-black/40 transition-colors group-hover:bg-black/60", `text-${color}-400`)}>
                    {icon}
                </div>
                <span className="text-3xl font-bold text-white tracking-tight">{count}</span>
            </div>
            <div className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">{label}</div>
            {subtext && <div className="text-xs text-gray-600 mt-1 font-mono group-hover:text-gray-500">{subtext}</div>}
        </div>
    );
}
