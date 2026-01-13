import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
  Shield
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { ValidationResult, Severity } from '../types/topology';

interface ValidationPanelProps {
  validationResults: ValidationResult[];
  isValidating?: boolean;
  onItemClick?: (nodeIds: string[]) => void;
  className?: string;
}

const severityConfig: Record<Severity, { icon: typeof AlertCircle; color: string; bgColor: string; borderColor: string }> = {
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20'
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  }
};

export function ValidationPanel({
  validationResults,
  isValidating = false,
  onItemClick,
  className
}: ValidationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const errorCount = validationResults.filter(r => r.severity === 'error').length;
  const warningCount = validationResults.filter(r => r.severity === 'warning').length;
  const infoCount = validationResults.filter(r => r.severity === 'info').length;
  const hasIssues = validationResults.length > 0;

  const getStatusLabel = () => {
    if (isValidating) return 'Validating...';
    if (errorCount > 0) return `${errorCount} error${errorCount > 1 ? 's' : ''} found`;
    if (warningCount > 0) return `${warningCount} warning${warningCount > 1 ? 's' : ''}`;
    return 'All checks passed';
  };

  const getStatusColor = () => {
    if (isValidating) return 'text-gray-400';
    if (errorCount > 0) return 'text-red-400';
    if (warningCount > 0) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className={cn(
      "rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden",
      className
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            hasIssues && !isValidating ? "bg-amber-500/10" : "bg-indigo-500/10"
          )}>
            {isValidating ? (
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            ) : hasIssues ? (
              <Shield className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">Validation</div>
            <div className={cn("text-xs", getStatusColor())}>
              {getStatusLabel()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity badges */}
          {!isValidating && (
            <div className="flex items-center gap-1.5">
              {errorCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                  {warningCount}
                </span>
              )}
              {infoCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  {infoCount}
                </span>
              )}
            </div>
          )}

          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {isValidating ? (
                <div className="flex items-center gap-2 py-3 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running validation checks...</span>
                </div>
              ) : validationResults.length === 0 ? (
                <div className="flex items-center gap-2 py-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    All validation checks passed!
                  </span>
                </div>
              ) : (
                validationResults.map((result) => {
                  const config = severityConfig[result.severity];
                  const Icon = config.icon;

                  return (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => result.nodeIds && onItemClick?.(result.nodeIds)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                        config.bgColor,
                        config.borderColor,
                        result.nodeIds && "hover:scale-[1.02] cursor-pointer"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", config.color)}>
                          {result.message}
                        </p>
                        {result.nodeIds && result.nodeIds.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Click to highlight: {result.nodeIds.slice(0, 3).join(', ')}
                            {result.nodeIds.length > 3 && ` +${result.nodeIds.length - 3} more`}
                          </p>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
