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
  getErrorCount(): number;
  path: string;
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
  const traceDir = path.join(workspaceRoot, '.vibes', 'traces');
  const traceFile = path.join(traceDir, `${taskId}.jsonl`);
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
    event(evt: ExecutionEvent): Promise<void> {
      const envelope: ExecutionEnvelope = createExecutionEnvelope(evt, {
        runId,
        missionId,
        taskId,
        attempt: options.attempt,
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

/** Read valid envelopes and ignore only an incomplete final JSONL record. */
export async function readTraceFile(traceFile: string): Promise<ExecutionEnvelope[]> {
  let content: string;
  try {
    content = await fs.readFile(traceFile, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split('\n').filter(Boolean);
  const envelopes: ExecutionEnvelope[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      envelopes.push(JSON.parse(lines[index]) as ExecutionEnvelope);
    } catch (error) {
      if (index === lines.length - 1) break;
      throw error;
    }
  }
  return envelopes;
}
