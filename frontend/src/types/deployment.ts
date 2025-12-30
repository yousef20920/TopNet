export type Stage = 'idle' | 'connect' | 'plan' | 'review' | 'apply' | 'verify' | 'complete' | 'failed' | 'destroying';

export interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

export interface PlanSummary {
    resourceCount: number;
    resourceList: string[];
    estimatedCost: number;
}
