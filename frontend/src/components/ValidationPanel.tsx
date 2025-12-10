// src/components/ValidationPanel.tsx
// Display validation results

import type { ValidationResult } from '../types/topology';

interface ValidationPanelProps {
  results: ValidationResult[];
}

const SEVERITY_STYLES = {
  info: {
    bg: 'bg-blue-900/50',
    border: 'border-blue-500',
    icon: 'ℹ️',
  },
  warning: {
    bg: 'bg-yellow-900/50',
    border: 'border-yellow-500',
    icon: '⚠️',
  },
  error: {
    bg: 'bg-red-900/50',
    border: 'border-red-500',
    icon: '❌',
  },
};

export function ValidationPanel({ results }: ValidationPanelProps) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const style = SEVERITY_STYLES[result.severity];
        return (
          <div
            key={result.id}
            className={`p-3 rounded border-l-4 ${style.bg} ${style.border}`}
          >
            <div className="flex items-start gap-2">
              <span>{style.icon}</span>
              <div>
                <p className="text-sm text-gray-200">{result.message}</p>
                {result.nodeIds && result.nodeIds.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Nodes: {result.nodeIds.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
