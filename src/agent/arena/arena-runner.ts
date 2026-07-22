import type { ArenaResult, ArenaRunOptions } from './arena-types.js';

export async function runArena(options: ArenaRunOptions): Promise<ArenaResult[]> {
  const candidates = options.candidates.slice(0, options.maxCandidates ?? 3);
  const results: ArenaResult[] = [];
  for (const candidate of candidates) {
    if (options.signal?.aborted) {
      results.push({ candidateId: candidate.id, model: candidate.model, status: 'cancelled', durationMs: 0 });
      continue;
    }
    const started = Date.now();
    try {
      const result = await options.runCandidate(candidate);
      results.push({
        candidateId: candidate.id,
        model: candidate.model,
        status: 'completed',
        durationMs: Date.now() - started,
        ...result,
      });
    } catch (error) {
      results.push({
        candidateId: candidate.id,
        model: candidate.model,
        status: 'failed',
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
