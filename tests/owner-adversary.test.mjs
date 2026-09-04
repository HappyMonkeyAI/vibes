import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOwnerAdversaryPrompt } from '../dist/agent/reviewer.js';
import { evaluateMissionCompletion } from '../dist/agent/mission-integrator.js';

const handoff = {
  taskId: 'integration', status: 'done', worktree: '/repo', branch: 'ag/integration', baseline: 'HEAD',
  changedPaths: ['src/App.tsx'],
  commandsAndResults: [{ command: 'npm test', exitCode: 0, summary: 'passed' }],
  knownFailuresOrSkips: [], commit: null, push: false, verificationLayers: ['integration'],
};

test('Owner adversary prompt owns mission-wide acceptance, not leaf review scope', () => {
  const { systemPrompt, userPrompt } = buildOwnerAdversaryPrompt(
    { title: 'Loading skeleton', description: 'Add a loading skeleton with Suspense' },
    [{ title: 'Create shapes', acceptance_criteria: ['Shapes exist'] }],
    'diff -- src/App.tsx',
  );

  assert.match(systemPrompt, /independent Owner-as-Adversary/i);
  assert.match(systemPrompt, /real entrypoint/i);
  assert.match(systemPrompt, /Output ONLY a JSON object/i);
  assert.match(userPrompt, /Suspense/);
  assert.match(userPrompt, /Create shapes/);
});

test('mission completion rejects an explicitly unapproved Owner review', () => {
  const result = evaluateMissionCompletion({
    ownerReview: { approved: false, issues: [{ file: 'src/App.tsx', line: 1, comment: 'Not wired', severity: 'error' }] },
    milestones: [{ tasks: [
      { id: 'task-1', title: 'Create component', description: '', status: 'done' },
      { id: 'task-2', title: 'Final integration and verification', description: '', status: 'done', evidenceHandoff: handoff },
    ] }],
  });

  assert.equal(result.approved, false);
  assert.ok(result.reasons.some(reason => reason.includes('Owner adversary')));
});
