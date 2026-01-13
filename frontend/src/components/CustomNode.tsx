import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
    Globe,
    Box,
    Shield,
    Scale,
    Server,
    Database,
    Activity,
    Signpost,
    Cloud
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { NodeKind } from '../types/topology';

// Map node kinds to icons
const NODE_ICONS: Record<NodeKind, React.ElementType> = {
    network: Cloud,            // VPC
    subnet: Box,               // Subnet
    security_group: Shield,    // Security Group
    load_balancer: Scale,      // ALB
    compute_instance: Server,  // EC2
    database: Database,        // RDS
    gateway: Globe,            // IGW/NAT
    traffic_generator: Activity,
    route_table: Signpost,     // Route Table
};

// Map node kinds to colors (tailwind classes would be better, but we need hex for style/border)
// We'll use these to set CSS variables or inline styles for specific color accents
const NODE_COLORS: Record<NodeKind, string> = {
    network: '#4F46E5',        // Indigo
    subnet: '#10B981',         // Emerald
    security_group: '#F59E0B', // Amber
    load_balancer: '#8B5CF6',  // Violet
    compute_instance: '#3B82F6', // Blue
    database: '#EF4444',       // Red
    gateway: '#06B6D4',        // Cyan
    traffic_generator: '#EC4899', // Pink
    route_table: '#6B7280',    // Gray
};

export function CustomNode({ data, selected }: NodeProps) {
    const kind = data.kind as NodeKind;
    const name = (data.name as string) || data.id as string;
    const highlighted = data.highlighted as boolean | undefined;

    const Icon = NODE_ICONS[kind] || Box;
    const color = NODE_COLORS[kind] || '#6B7280';

    return (
        <div
            className={cn(
                "min-w-[180px] rounded-lg border-2 bg-gray-900/90 backdrop-blur-sm shadow-lg transition-all duration-200 group",
                selected ? "ring-2 ring-white/50 border-transparent" : "border-gray-800 hover:border-gray-600",
                highlighted && "ring-4 ring-amber-400/70 animate-pulse"
            )}
            style={{
                borderColor: selected ? undefined : (highlighted ? '#F59E0B' : color),
                boxShadow: highlighted
                    ? `0 0 30px #F59E0B60, 0 0 60px #F59E0B30`
                    : (selected ? `0 0 20px ${color}40` : `0 0 10px ${color}20`)
            }}
        >
            <div className="flex items-center gap-3 p-3">
                {/* Icon Container */}
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-inner"
                    style={{
                        backgroundColor: `${color}20`,
                        color: color
                    }}
                >
                    <Icon className="w-5 h-5" />
                </div>

                {/* Details */}
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                        {kind.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-semibold text-gray-100 truncate pr-2">
                        {name}
                    </span>
                </div>
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-gray-400 !border-gray-800 transition-colors group-hover:!bg-white"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 !bg-gray-400 !border-gray-800 transition-colors group-hover:!bg-white"
            />
        </div>
    );
}
