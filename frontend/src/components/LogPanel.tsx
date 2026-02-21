import { useRef, useEffect } from 'react';
import { Terminal, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LogEntry } from '../types/deployment';

interface LogPanelProps {
    logs: LogEntry[];
    isOpen: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onClose: () => void;
    style?: React.CSSProperties;
}

export function LogPanel({ logs, isOpen, isExpanded, onToggleExpand, onClose, style }: LogPanelProps) {
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    if (!isOpen) return null;

    return (
        <div
            style={style}
            className={cn(
                "fixed bottom-0 left-0 bg-[#0c0c0e] border-t border-white/10 transition-all duration-300 shadow-2xl flex flex-col font-mono z-40",
                isExpanded ? "h-[300px]" : "h-10"
            )}>
            {/* Header */}
            <div
                className="h-10 flex items-center justify-between px-4 bg-white/5 border-b border-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Terminal Output</span>
                    {logs.length > 0 && (
                        <span className="bg-gray-800 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full">
                            {logs.length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onToggleExpand(); }} className="p-1 text-gray-400 hover:text-white transition-colors">
                        {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 text-gray-400 hover:text-white transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-[#0a0a0f] border-t border-white/5 p-3 overflow-y-auto custom-scrollbar text-xs">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 opacity-50">
                        <Terminal className="w-6 h-6 mb-1 opacity-30" />
                        <p className="text-xs">No deployment logs yet</p>
                    </div>
                ) : (
                    <div className="font-mono space-y-0.5">
                        {logs.map((log) => {
                            const isSection = log.message.startsWith('─');
                            const isError = log.type === 'error';

                            // Skip separator lines
                            if (isSection) return null;

                            return (
                                <div
                                    key={log.id}
                                    className={cn(
                                        "px-2 py-1 flex gap-2 items-start rounded",
                                        isError && "bg-red-500/10 border-l-2 border-red-500/50",
                                        log.type === 'success' && "text-emerald-400"
                                    )}
                                >
                                    <span className="text-gray-600 w-[50px] shrink-0 select-none text-[10px] pt-0.5">
                                        {log.timestamp}
                                    </span>
                                    <span className={cn(
                                        "flex-1 leading-relaxed text-[11px]",
                                        log.type === 'info' && "text-gray-400",
                                        log.type === 'success' && "text-emerald-400",
                                        log.type === 'warning' && "text-amber-300",
                                        log.type === 'error' && "text-red-400"
                                    )}>
                                        {log.message}
                                    </span>
                                </div>
                            );
                        })}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </div>
        </div>
    );
}
