/**
 * Trace recorder — persists execution envelopes to a JSONL trace file.
 * This is a secondary persistence layer alongside the in-memory onEvent callback.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ExecutionEnvelope, ExecutionEvent } from './types.js';
import { createExecutionEnvelope } from './types.js';

export interface TraceRecorderOptions {
  workspaceRoot?: string;
  runId?: string;
  missionId?: string;
  attempt?: number;
}

export interface TraceRecorder {
  event(evt: ExecutionEvent): Promise<void>;
  /** Resolves only after every queued event has reached the filesystem. */
  flush(): Promise<void>;
  getErrorCount(): number;
  path: string;
}

export interface TraceReadResult {
  envelopes: ExecutionEnvelope[];
  /** Line numbers (1-based) that could not be parsed and were skipped. */
  skippedLines: number[];
}

/**
 * One trace file per attempt. Sharing a file across attempts would restart
 * `sequence` at 1 partway through it, so records could not be ordered.
 */
export function traceFilePath(workspaceRoot: string, taskId: string, attempt: number): string {
  return path.join(path.resolve(workspaceRoot), '.vibes', 'traces', `${taskId}.attempt-${attempt}.jsonl`);
}

/**
 * Creates a trace recorder below the mission workspace.
 * Writes are serialized so concurrent task events retain append order.
 */
export function createTraceRecorder(
  taskId: string,
  _sessionType: string,
  options: TraceRecorderOptions = {},
): TraceRecorder {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
  const attempt = options.attempt ?? 1;
  const traceFile = traceFilePath(workspaceRoot, taskId, attempt);
  const traceDir = path.dirname(traceFile);
  const runId = options.runId ?? taskId;
  const missionId = options.missionId ?? runId;
  let sequence = 0;
  let writeQueue: Promise<void> = Promise.resolve();
  let errorCount = 0;

  const ensureDir = async () => {
    await fs.mkdir(traceDir, { recursive: true });
  };

  return {
    path: traceFile,
    getErrorCount: () => errorCount,
    flush: () => writeQueue,
    event(evt: ExecutionEvent): Promise<void> {
      const envelope: ExecutionEnvelope = createExecutionEnvelope(evt, {
        runId,
        missionId,
        taskId,
        attempt,
        sequence: ++sequence,
      });
      const nextWrite = writeQueue.then(async () => {
        await ensureDir();
        await fs.appendFile(traceFile, `${JSON.stringify(envelope)}\n`, 'utf8');
      }).catch(() => {
        errorCount += 1;
      });
      writeQueue = nextWrite;
      return nextWrite;
    },
  };
}

/**
 * Read every envelope that parses and report the ones that did not. A single
 * corrupt record in the middle of an append-only journal must not make the whole
 * run unreplayable — a partially readable trace is the point of the format.
 */
export async function readTraceFileDetailed(traceFile: string): Promise<TraceReadResult> {
  let content: string;
  try {
    content = await fs.readFile(traceFile, 'utf8');
  } catch {
    return { envelopes: [], skippedLines: [] };
  }

  const envelopes: ExecutionEnvelope[] = [];
  const skippedLines: number[] = [];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      envelopes.push(JSON.parse(line) as ExecutionEnvelope);
    } catch {
      skippedLines.push(index + 1);
    }
  }

  return { envelopes, skippedLines };
}

export async function readTraceFile(traceFile: string): Promise<ExecutionEnvelope[]> {
  return (await readTraceFileDetailed(traceFile)).envelopes;
}
