import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ContextPackSchema,
  EvidenceHandoffSchema,
  createContextPack,
  createEvidenceHandoff,
} from '../dist/agent/protocol-contracts.js';

test('context pack captures bounded worker scope and verification contract', () => {
  const pack = createContextPack(
    {
      id: 'mission-1',
      workspace_root: '/repo',
      milestones: [],
    },
    {
      id: 'task-1',
      title: 'Implement feature',
      description: 'Implement the feature',
      files: ['src/feature.ts'],
      depends_on: ['task-0'],
      type: 'code',
    },
    {
      worktree: '/repo/.worktrees/task-1',
      baseRef: 'abc123',
      verifyCommands: ['npm run build'],
      constraints: ['no push', 'no drive-by refactor'],
    },
  );

  assert.deepEqual(ContextPackSchema.parse(pack), pack);
  assert.equal(pack.taskId, 'task-1');
  assert.deepEqual(pack.ownedFiles, ['src/feature.ts']);
  assert.deepEqual(pack.dependsOn, ['task-0']);
});

test('evidence handoff requires explicit real command results and status', () => {
  const handoff = createEvidenceHandoff(
    {
      id: 'task-1',
      status: 'done',
      files: ['src/feature.ts'],
    },
    {
      worktree: '/repo/.worktrees/task-1',
      branch: 'ag/task-1',
      baseline: 'abc123',
      commandsAndResults: [{ command: 'npm run build', exitCode: 0, summary: 'passed' }],
      verificationLayers: ['unit'],
      commit: null,
      push: false,
    },
  );

  assert.deepEqual(EvidenceHandoffSchema.parse(handoff), handoff);
  assert.equal(handoff.status, 'done');
  assert.equal(handoff.commandsAndResults[0].exitCode, 0);
  assert.equal(handoff.push, false);
});

test('malformed handoffs are rejected instead of treated as acceptance evidence', () => {
  const result = EvidenceHandoffSchema.safeParse({
    taskId: 'task-1',
    status: 'done',
    changedPaths: [],
  });

  assert.equal(result.success, false);
});
