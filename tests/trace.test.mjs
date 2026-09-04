import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createTraceRecorder, readTraceFile, readTraceFileDetailed, traceFilePath } from '../dist/agent/trace.js';

test('trace recorder writes ordered workspace-scoped envelopes', async () => {
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

  assert.equal(recorder.path, traceFilePath(workspace, 'task-1', 2));
  const lines = (await fs.readFile(recorder.path, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(line => JSON.parse(line).sequence), [1, 2]);
  assert.deepEqual(lines.map(line => JSON.parse(line).attempt), [2, 2]);
  assert.deepEqual((await readTraceFile(recorder.path)).map(item => item.event.content), ['one', 'two']);
  await fs.rm(workspace, { recursive: true, force: true });
});

test('each attempt gets its own trace file so sequence numbers stay unique', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-trace-attempt-'));
  const first = createTraceRecorder('task-1', 'session', { workspaceRoot: workspace, attempt: 1 });
  const second = createTraceRecorder('task-1', 'session', { workspaceRoot: workspace, attempt: 2 });

  await first.event({ type: 'output', content: 'attempt one' });
  await second.event({ type: 'output', content: 'attempt two' });

  assert.notEqual(first.path, second.path);
  assert.deepEqual((await readTraceFile(first.path)).map(e => e.event.content), ['attempt one']);
  assert.deepEqual((await readTraceFile(second.path)).map(e => e.event.content), ['attempt two']);
  await fs.rm(workspace, { recursive: true, force: true });
});

test('a corrupt record anywhere in the journal is skipped, not fatal', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-trace-corrupt-'));
  const recorder = createTraceRecorder('task-1', 'session', { workspaceRoot: workspace, attempt: 1 });

  await recorder.event({ type: 'output', content: 'one' });
  // A torn record in the MIDDLE of the file, not just a truncated tail.
  await fs.appendFile(recorder.path, '{"broken":\n', 'utf8');
  await recorder.event({ type: 'output', content: 'two' });
  await fs.appendFile(recorder.path, '{"also-truncated":', 'utf8');

  const result = await readTraceFileDetailed(recorder.path);
  assert.deepEqual(result.envelopes.map(item => item.event.content), ['one', 'two']);
  assert.deepEqual(result.skippedLines, [2, 4]);
  await fs.rm(workspace, { recursive: true, force: true });
});
