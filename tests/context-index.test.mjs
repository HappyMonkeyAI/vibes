import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'fs';
import path from 'path';

import { ContextIndexService } from '../dist/agent/context-index.js';

const TEST_DB = path.join(process.cwd(), '.vibes', 'test_context_snapshots.db');
const TEST_JSONL = path.join(process.cwd(), '.vibes', 'test_context_snapshots.jsonl');

// Helper to clean up test files
function cleanup() {
  if (fs.existsSync(TEST_DB)) {
    try { fs.unlinkSync(TEST_DB); } catch (e) {}
  }
  if (fs.existsSync(TEST_JSONL)) {
    try { fs.unlinkSync(TEST_JSONL); } catch (e) {}
  }
}

test('SQLite context index - CRUD operations', async () => {
  cleanup();

  const service = new ContextIndexService(TEST_DB, TEST_JSONL);
  await service.init();

  assert.equal(service.isFallback(), false);

  // Append snapshots
  const id1 = await service.append('Memory', 'durable system configuration settings and workspace roots');
  const id2 = await service.append('Notes', 'discovered a compilation bug in compiler.ts');
  const id3 = await service.append('Progress', 'completed setting up schema validation');

  assert.ok(id1 > 0);
  assert.ok(id2 > id1);
  assert.ok(id3 > id2);

  // Query snaps using MATCH (FTS5 matches)
  const results1 = await service.query('compilation');
  assert.equal(results1.length, 1);
  assert.equal(results1[0].layer_name, 'Notes');
  assert.equal(results1[0].raw_content, 'discovered a compilation bug in compiler.ts');

  const results2 = await service.query('settings OR schema');
  assert.equal(results2.length, 2);

  // Delete snapshot
  await service.delete(id2);
  const resultsAfterDelete = await service.query('compilation');
  assert.equal(resultsAfterDelete.length, 0);

  // Clear snapshots
  await service.clear();
  const resultsAfterClear = await service.query('settings');
  assert.equal(resultsAfterClear.length, 0);

  service.close();
  cleanup();
});

test('Fallback context index - CRUD operations', async () => {
  cleanup();

  const service = new ContextIndexService(TEST_DB, TEST_JSONL);
  // Force fallback mode manually for test coverage
  await service.init();
  // Override isUsingFallback to simulate a system without SQLite support
  service['isUsingFallback'] = true;
  service.close(); // Close SQLite handle so we only use fallback

  assert.equal(service.isFallback(), true);

  // Append snapshots
  const id1 = await service.append('Memory', 'durable system configuration settings and workspace roots');
  const id2 = await service.append('Notes', 'discovered a compilation bug in compiler.ts');

  assert.equal(id1, 1);
  assert.equal(id2, 2);

  // Query snaps (substring matching)
  const results1 = await service.query('compilation');
  assert.equal(results1.length, 1);
  assert.equal(results1[0].layer_name, 'Notes');

  const results2 = await service.query('settings');
  assert.equal(results2.length, 1);
  assert.equal(results2[0].layer_name, 'Memory');

  // Delete snapshot
  await service.delete(id2);
  const resultsAfterDelete = await service.query('compilation');
  assert.equal(resultsAfterDelete.length, 0);

  // Clear snapshots
  await service.clear();
  const resultsAfterClear = await service.query('settings');
  assert.equal(resultsAfterClear.length, 0);

  cleanup();
});
