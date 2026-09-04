import assert from 'node:assert/strict';
import test from 'node:test';

import { runArena } from '../dist/agent/arena/arena-runner.js';

test('arena runner bounds candidates, preserves evidence, and does not auto-select a winner', async () => {
  const results = await runArena({
    maxCandidates: 2,
    candidates: [
      { id: 'a', model: 'model-a', workspaceRoot: '/tmp/a' },
      { id: 'b', model: 'model-b', workspaceRoot: '/tmp/b' },
      { id: 'c', model: 'model-c', workspaceRoot: '/tmp/c' },
    ],
    runCandidate: async candidate => {
      if (candidate.id === 'b') throw new Error('provider unavailable');
      return { evidence: [`${candidate.id}:build:0`] };
    },
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].status, 'completed');
  assert.deepEqual(results[0].evidence, ['a:build:0']);
  assert.equal(results[1].status, 'failed');
  assert.match(results[1].error, /provider unavailable/);
  // No candidate is anointed: the runner reports evidence, the caller decides.
  assert.equal(results.every(result => !('winner' in result)), true);
});
