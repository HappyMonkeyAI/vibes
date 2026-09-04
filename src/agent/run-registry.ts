export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stale';

export interface RunRecord {
  runId: string;
  missionId: string;
  taskId: string;
  title: string;
  status: RunStatus;
  workerId?: string;
  attempt: number;
  startedAt?: string;
  completedAt?: string;
  currentTool?: string;
  lastOutput?: string;
  error?: string;
  transcriptPath?: string;
}

export interface RunRegistration {
  runId: string;
  missionId: string;
  taskId: string;
  title: string;
  attempt?: number;
  transcriptPath?: string;
}

export class RunRegistry {
  private readonly runs = new Map<string, RunRecord>();
  private readonly staleAfterMs: number;
  private readonly persistPath?: string;

  constructor(options: { staleAfterMs?: number; persistPath?: string } = {}) {
    this.staleAfterMs = options.staleAfterMs ?? 5 * 60 * 1000;
    this.persistPath = options.persistPath;
  }

  register(input: RunRegistration): RunRecord {
    const existing = this.runs.get(input.runId);
    if (existing) return { ...existing };
    const record: RunRecord = {
      ...input,
      status: 'queued',
      attempt: input.attempt ?? 1,
    };
    this.runs.set(input.runId, record);
    return { ...record };
  }

  start(runId: string, workerId: string): RunRecord {
    const run = this.require(runId);
    if (this.isTerminal(run.status)) return { ...run };
    run.status = 'running';
    run.workerId = workerId;
    run.startedAt ??= new Date().toISOString();
    return { ...run };
  }

  update(runId: string, patch: Partial<Pick<RunRecord, 'currentTool' | 'lastOutput' | 'transcriptPath'>>): RunRecord {
    const run = this.require(runId);
    if (!this.isTerminal(run.status)) Object.assign(run, patch);
    return { ...run };
  }

  /** Best-effort progress update — a run that has already gone away is not an error. */
  tryUpdate(runId: string, patch: Partial<Pick<RunRecord, 'currentTool' | 'lastOutput' | 'transcriptPath'>>): void {
    if (this.runs.has(runId)) this.update(runId, patch);
  }

  complete(runId: string): RunRecord {
    return this.finish(runId, 'completed');
  }

  fail(runId: string, error: string): RunRecord {
    const run = this.require(runId);
    if (!this.isTerminal(run.status)) {
      run.error = error;
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
    }
    return { ...run };
  }

  cancel(runId: string): RunRecord {
    return this.finish(runId, 'cancelled');
  }

  markStale(now = Date.now()): number {
    let count = 0;
    const stamp = Number.isFinite(now) ? new Date(now).toISOString() : new Date().toISOString();
    for (const run of this.runs.values()) {
      if (run.status !== 'running' || !run.startedAt) continue;
      const startedAt = Date.parse(run.startedAt);
      if (Number.isNaN(startedAt) || now - startedAt >= this.staleAfterMs) {
        run.status = 'stale';
        run.completedAt = stamp;
        count += 1;
      }
    }
    return count;
  }

  /**
   * Mark every non-terminal run stale regardless of age. Used on restore: a run
   * still recorded as queued or running belongs to a process that has since died.
   */
  markInterrupted(): number {
    let count = 0;
    const stamp = new Date().toISOString();
    for (const run of this.runs.values()) {
      if (this.isTerminal(run.status)) continue;
      run.status = 'stale';
      run.completedAt = stamp;
      count += 1;
    }
    return count;
  }

  get(runId: string): RunRecord | undefined {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }

  list(): RunRecord[] {
    return [...this.runs.values()].map(run => ({ ...run }));
  }

  async save(): Promise<void> {
    if (!this.persistPath) return;
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(path.dirname(this.persistPath), { recursive: true });
    const tempPath = `${this.persistPath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.list(), null, 2), 'utf8');
    await fs.rename(tempPath, this.persistPath);
  }

  restore(records: RunRecord[]): void {
    for (const record of records) this.runs.set(record.runId, { ...record });
  }

  private finish(runId: string, status: 'completed' | 'cancelled'): RunRecord {
    const run = this.require(runId);
    if (!this.isTerminal(run.status)) {
      run.status = status;
      run.completedAt = new Date().toISOString();
    }
    return { ...run };
  }

  private require(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown run: ${runId}`);
    return run;
  }

  private isTerminal(status: RunStatus): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'stale';
  }
}
