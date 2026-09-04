import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { dedupeMemoryItems, normalizeMemoryItem } from '../dist/memory/memory-item.js';
import { LocalMemoryService } from '../dist/memory/local-memory.js';

test('memory items normalize confidence and deduplicate by newest stable ID', () => {
  const old = normalizeMemoryItem({ id: 'm-1', summary: 'old', content: 'old', confidence: 2, status: 'active', timestamp: '2026-07-21T00:00:00Z' });
  const newer = normalizeMemoryItem({ id: 'm-1', summary: 'new', content: 'new', confidence: -1, status: 'active', timestamp: '2026-07-22T00:00:00Z' });
  const superseded = normalizeMemoryItem({ id: 'm-2', summary: 'gone', content: 'gone', confidence: 0.5, status: 'superseded' });

  const active = dedupeMemoryItems([old, newer, superseded]);
  assert.equal(active.length, 1);
  assert.equal(active[0].summary, 'new');
  assert.equal(active[0].confidence, 0);
});

test('LocalMemoryService stores structured items without replacing legacy memory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-memory-'));
  const service = new LocalMemoryService('test', { storageDir: root });
  await service.addContext('legacy context');
  await service.addMemoryItem({ summary: 'Use bounded traces', content: 'Trace files must be bounded and replayable.', confidence: 0.9, status: 'active', source: 'src/agent/trace.ts' });
  const items = await service.retrieveMemoryItems('replayable traces');
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'src/agent/trace.ts');
  assert.match(await fs.readFile(path.join(root, 'test.jsonl'), 'utf8'), /legacy context/);
  await fs.rm(root, { recursive: true, force: true });
});

test('an item that supersedes another retires it', () => {
  const original = normalizeMemoryItem({ id: 'm-1', summary: 'old fact', content: 'old', confidence: 0.8, status: 'active', timestamp: '2026-07-21T00:00:00Z' });
  const replacement = normalizeMemoryItem({ id: 'm-2', summary: 'new fact', content: 'new', confidence: 0.9, status: 'active', supersedes: 'm-1', timestamp: '2026-07-22T00:00:00Z' });

  const active = dedupeMemoryItems([original, replacement]);
  assert.deepEqual(active.map(item => item.id), ['m-2']);
});

test('a non-finite confidence clamps to zero rather than becoming NaN', () => {
  assert.equal(normalizeMemoryItem({ summary: 's', content: 'c', confidence: Number.NaN, status: 'active' }).confidence, 0);
  assert.equal(normalizeMemoryItem({ summary: 's', content: 'c', confidence: Number.POSITIVE_INFINITY, status: 'active' }).confidence, 1);
});

test('a torn line does not destroy recall for the rest of the journal', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-memory-torn-'));
  const service = new LocalMemoryService('test', { storageDir: root });
  await service.addMemoryItem({ summary: 'Bounded traces', content: 'Traces must be replayable.', confidence: 0.9, status: 'active' });
  await fs.appendFile(path.join(root, 'items', 'test.jsonl'), '{"torn":\n', 'utf8');
  await service.addMemoryItem({ summary: 'Second fact', content: 'Traces are also bounded.', confidence: 0.8, status: 'active' });

  const items = await service.retrieveMemoryItems('replayable traces bounded');
  assert.equal(items.length, 2);
  await fs.rm(root, { recursive: true, force: true });
});
