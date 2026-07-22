import type { CompletionReceipt } from '../completion-receipt.js';

export interface ArenaCandidate {
  id: string;
  model: string;
  workspaceRoot: string;
}

export interface ArenaResult {
  candidateId: string;
  model: string;
  status: 'completed' | 'failed' | 'cancelled';
  durationMs: number;
  receipt?: CompletionReceipt;
  evidence?: string[];
  error?: string;
}

export interface ArenaRunOptions {
  candidates: ArenaCandidate[];
  maxCandidates?: number;
  signal?: AbortSignal;
  runCandidate: (candidate: ArenaCandidate) => Promise<{ receipt?: CompletionReceipt; evidence?: string[] }>;
}
