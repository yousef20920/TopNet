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
            <div className="flex-1 bg-black/90 p-4 overflow-y-auto custom-scrollbar text-xs">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 opacity-50">
                        <p>No logs available.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-3">
                                <span className="text-gray-600 w-16 shrink-0 select-none">{log.timestamp}</span>
                                <span className={cn(
                                    "flex-1 break-all",
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
        </div>
    );
}
