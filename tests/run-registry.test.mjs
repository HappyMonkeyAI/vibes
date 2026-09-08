import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { RunRegistry } from '../dist/agent/run-registry.js';

test('RunRegistry tracks worker lifecycle and rejects terminal rewrites', () => {
  const registry = new RunRegistry();
  registry.register({ runId: 'run-1', missionId: 'mission-1', taskId: 'task-1', title: 'Task' });
  registry.start('run-1', 'worker-1');
  registry.update('run-1', { currentTool: 'shell', lastOutput: 'running' });
  registry.complete('run-1');
  registry.fail('run-1', 'late failure');

  const run = registry.get('run-1');
  assert.equal(run?.status, 'completed');
  assert.equal(run?.workerId, 'worker-1');
  assert.equal(run?.currentTool, 'shell');
  assert.equal(run?.lastOutput, 'running');
});

test('RunRegistry lists stale runs by age', () => {
  const registry = new RunRegistry({ staleAfterMs: 10 });
  registry.register({ runId: 'run-2', missionId: 'mission-1', taskId: 'task-2', title: 'Task' });
  registry.start('run-2', 'worker-2');
  assert.equal(registry.markStale(Date.now() + 20), 1);
  assert.equal(registry.get('run-2')?.status, 'stale');
});

test('RunRegistry saves an atomic durable roster and restores it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-runs-'));
  const file = path.join(root, 'runs.json');
  const registry = new RunRegistry({ persistPath: file });
  registry.register({ runId: 'run-3', missionId: 'm', taskId: 't', title: 'Persist me' });
  registry.start('run-3', 'worker-3');
  await registry.save();

  const restored = new RunRegistry();
  restored.restore(JSON.parse(await fs.readFile(file, 'utf8')));
  assert.equal(restored.get('run-3')?.workerId, 'worker-3');
  await fs.rm(root, { recursive: true, force: true });
});

test('RunRegistry.update patches a single field', () => {
  const registry = new RunRegistry();
  registry.register({ runId: 'run-4', missionId: 'm', taskId: 't', title: 'Task' });
  registry.start('run-4', 'worker-4');
  registry.update('run-4', { currentTool: 'shell' });
  registry.update('run-4', { lastOutput: 'shell: ok' });

  const run = registry.get('run-4');
  assert.equal(run?.currentTool, 'shell');
  assert.equal(run?.lastOutput, 'shell: ok');
});

test('restored runs left mid-flight by a dead process are marked stale', () => {
  const registry = new RunRegistry();
  registry.restore([
    { runId: 'a', missionId: 'm', taskId: 't1', title: 'A', status: 'running', attempt: 1, startedAt: new Date().toISOString() },
    { runId: 'b', missionId: 'm', taskId: 't2', title: 'B', status: 'queued', attempt: 1 },
    { runId: 'c', missionId: 'm', taskId: 't3', title: 'C', status: 'completed', attempt: 1 },
  ]);

  assert.equal(registry.markInterrupted(), 2);
  assert.equal(registry.get('a')?.status, 'stale');
  assert.equal(registry.get('b')?.status, 'stale');
  assert.equal(registry.get('c')?.status, 'completed');
});

test('RunRegistry serializes concurrent saves using the same persistence path', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-runs-concurrent-'));
  const file = path.join(root, 'runs.json');
  const registry = new RunRegistry({ persistPath: file });

  for (let i = 0; i < 8; i += 1) {
    registry.register({ runId: `run-${i}`, missionId: 'm', taskId: `t-${i}`, title: `Task ${i}` });
  }

  await Promise.all(Array.from({ length: 20 }, () => registry.save()));

  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(saved.length, 8);
  assert.equal(await fs.stat(`${file}.tmp`).then(() => true).catch(() => false), false);
  await fs.rm(root, { recursive: true, force: true });
});
