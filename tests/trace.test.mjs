import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createTraceRecorder, readTraceFile } from '../dist/agent/trace.js';

test('trace recorder writes ordered workspace-scoped envelopes and tolerates a truncated tail', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-trace-'));
  const recorder = createTraceRecorder('task-1', 'session', {
    workspaceRoot: workspace,
    runId: 'run-1',
    missionId: 'mission-1',
    attempt: 2,
  });

  await Promise.all([
    recorder.event({ type: 'output', content: 'one' }),
    recorder.event({ type: 'output', content: 'two' }),
  ]);

  const tracePath = path.join(workspace, '.vibes', 'traces', 'task-1.jsonl');
  const lines = (await fs.readFile(tracePath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(line => JSON.parse(line).sequence), [1, 2]);
  assert.deepEqual((await readTraceFile(tracePath)).map(item => item.event.content), ['one', 'two']);

  await fs.appendFile(tracePath, '{"broken":', 'utf8');
  assert.equal((await readTraceFile(tracePath)).length, 2);
  await fs.rm(workspace, { recursive: true, force: true });
});
