import { useState, useEffect } from 'react';
import { Cloud, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const API_BASE = 'http://localhost:3001/api';

interface AWSAccountInfo {
    account_id: string | null;
    account_alias: string | null;
    user_name: string | null;
    region: string;
}

interface AwsAccountStatusProps {
    compact?: boolean;
}

export function AwsAccountStatus({ compact = false }: AwsAccountStatusProps) {
    const [account, setAccount] = useState<AWSAccountInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAccountInfo = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE}/aws/dashboard?region=us-east-2`);
                const data = await response.json();

                if (data.connected && data.account) {
                    setAccount(data.account);
                    setIsConnected(true);
                    setError(null);
                } else {
                    setIsConnected(false);
                    setAccount(null);
                    setError(data.error || 'AWS credentials not configured');
                }
            } catch (err) {
                setIsConnected(false);
                setAccount(null);
                setError('Failed to connect to AWS');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccountInfo();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Checking AWS...</span>
            </div>
        );
    }

    if (isConnected && account) {
        if (compact) {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 group hover:bg-emerald-500/20 transition-colors cursor-default">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono text-emerald-300">
                        {account.account_alias || account.account_id?.slice(-4) || 'AWS'}
                    </span>
                    <span className="text-xs text-emerald-300/60">•</span>
                    {account.user_name && (
                        <>
                            <span className="text-xs text-emerald-300">{account.user_name}</span>
                            <span className="text-xs text-emerald-300/60">•</span>
                        </>
                    )}
                    <span className="text-xs text-emerald-300/60">{account.region}</span>
                    <div className="hidden group-hover:block absolute top-full mt-2 right-0 bg-[#0c0c0e] border border-emerald-500/30 rounded-lg p-3 shadow-lg z-50 whitespace-nowrap text-xs">
                        <div className="space-y-1">
                            <div className="text-gray-400">
                                <span className="text-gray-600">Account:</span> {account.account_id}
                            </div>
                            {account.user_name && (
                                <div className="text-gray-400">
                                    <span className="text-gray-600">User:</span> {account.user_name}
                                </div>
                            )}
                            {account.account_alias && (
                                <div className="text-gray-400">
                                    <span className="text-gray-600">Alias:</span> {account.account_alias}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // Full version
        return (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-300">AWS Connected</span>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs text-emerald-300/70 border-l border-emerald-500/20 pl-3">
                    {account.user_name && (
                        <>
                            <span className="text-emerald-300 font-medium">{account.user_name}</span>
                            <span>•</span>
                        </>
                    )}
                    <span className="font-mono">{account.account_alias || account.account_id}</span>
                    <span>•</span>
                    <span>{account.region}</span>
                </div>
            </div>
        );
    }

    // Not connected or error
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 group hover:bg-amber-500/20 transition-colors cursor-default">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-300">No AWS</span>
            <div className="hidden group-hover:block absolute top-full mt-2 right-0 bg-[#0c0c0e] border border-amber-500/30 rounded-lg p-3 shadow-lg z-50 whitespace-nowrap text-xs">
                <div className="text-amber-300">
                    {error || 'AWS credentials not configured'}
                </div>
                <div className="text-amber-300/60 text-[11px] mt-2">
                    Run: aws configure
                </div>
            </div>
        </div>
    );
}
