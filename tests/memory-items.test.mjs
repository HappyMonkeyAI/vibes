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
