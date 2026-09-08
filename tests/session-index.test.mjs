import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { SessionIndex } from '../dist/agent/session-index.js';

test('SessionIndex persists bounded metadata independently of session payloads', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-session-index-'));
  const index = new SessionIndex(root);
  await index.upsert({ id: 'm-1', title: 'Mission', status: 'executing', updatedAt: '2026-07-22T16:00:00.000Z', eventCount: 4, workspace: root });
  await index.upsert({ id: 'm-2', title: 'Older', status: 'completed', updatedAt: '2026-07-21T16:00:00.000Z', eventCount: 2, workspace: root });

  const summaries = await index.list();
  assert.deepEqual(summaries.map(item => item.id), ['m-1', 'm-2']);
  assert.equal((await index.get('m-1'))?.eventCount, 4);
  await fs.rm(root, { recursive: true, force: true });
});
