import { useState, useEffect } from 'react';
import { DollarSign, Loader2, AlertCircle, Info } from 'lucide-react';
import type { TopologyGraph } from '../types/topology';
import { estimateCost, type CostEstimate } from '../api/topologyApi';

interface CostPanelProps {
    topology: TopologyGraph | null;
}

export function CostPanel({ topology }: CostPanelProps) {
    const [cost, setCost] = useState<CostEstimate | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!topology) {
            setCost(null);
            return;
        }

        const fetchCost = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const estimate = await estimateCost(topology);
                setCost(estimate);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to estimate cost');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCost();
    }, [topology]);

    if (!topology) {
        return null;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Cost Estimate
                </span>
            </div>

            {isLoading && (
                <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Calculating...</span>
                </div>
            )}

            {error && (
                <div className="p-2 bg-red-900/20 border border-red-500/30 rounded flex gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-xs text-red-300">{error}</p>
                </div>
            )}

            {cost && !isLoading && (
                <div className="space-y-3">
                    {/* Monthly Total */}
                    <div className="p-3 bg-gradient-to-r from-green-900/30 to-emerald-900/20 border border-green-500/20 rounded-lg">
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs text-gray-400">Monthly Estimate</span>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-green-400">
                                    ${cost.monthly_total.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500 ml-1">/month</span>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            ${cost.hourly_total.toFixed(4)}/hour
                        </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="space-y-1">
                        <span className="text-[10px] text-gray-500 uppercase">Breakdown</span>
                        <div className="space-y-1.5">
                            {cost.items.map((item, i) => (
                                <div 
                                    key={i} 
                                    className="flex items-center justify-between p-2 bg-white/5 rounded text-xs"
                                >
                                    <div>
                                        <div className="text-gray-300">{item.resource}</div>
                                        <div className="text-[10px] text-gray-500">{item.type}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-gray-300">${item.monthly.toFixed(2)}</div>
                                        <div className="text-[10px] text-gray-500">/month</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        {cost.free_tier_note && (
                            <div className="flex gap-1.5 p-2 bg-blue-900/20 border border-blue-500/20 rounded">
                                <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-blue-300">{cost.free_tier_note}</p>
                            </div>
                        )}
                        <p className="text-[10px] text-gray-600 italic">{cost.note}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
