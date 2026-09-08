import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateMissionCompletion } from '../dist/agent/mission-integrator.js';

test('rejects a multi-task mission when final integration is not done', () => {
  const result = evaluateMissionCompletion({
    milestones: [{ tasks: [
      { id: 'task-1', title: 'Create component', description: '', status: 'done' },
      { id: 'task-2', title: 'Final integration and verification', description: '', status: 'todo' },
    ] }],
  });

  assert.equal(result.approved, false);
  assert.ok(result.reasons.some(reason => reason.includes('integration')));
});

test('approves a mission only when every task and its integration gate are done', () => {
  const result = evaluateMissionCompletion({
    milestones: [{ tasks: [
      { id: 'task-1', title: 'Create component', description: '', status: 'done' },
      {
        id: 'task-2', title: 'Final integration and verification', description: '', status: 'done',
        evidenceHandoff: {
          taskId: 'task-2', status: 'done', worktree: '/repo', branch: 'ag/task-2', baseline: 'HEAD',
          changedPaths: ['src/App.tsx'],
          commandsAndResults: [{ command: 'npm test', exitCode: 0, summary: 'passed' }],
          knownFailuresOrSkips: [], commit: null, push: false, verificationLayers: ['integration'],
        },
      },
    ] }],
  });

  assert.deepEqual(result, { approved: true, reasons: [] });
});

test('rejects a mission with no tasks', () => {
  assert.deepEqual(evaluateMissionCompletion({ milestones: [] }), {
    approved: false,
    reasons: ['Mission contains no tasks'],
  });
});

test('rejects integration evidence when no changed path is grounded', () => {
  const result = evaluateMissionCompletion({ milestones: [{ tasks: [
    { id: 'task-1', title: 'Create component', description: '', status: 'done' },
    { id: 'task-2', title: 'Final integration and verification', description: '', status: 'done', evidenceHandoff: {
      taskId: 'task-2', status: 'done', worktree: '/repo', branch: 'ag/task-2', baseline: 'HEAD',
      changedPaths: [], commandsAndResults: [{ command: 'npm test', exitCode: 0, summary: 'passed' }],
      knownFailuresOrSkips: [], commit: null, push: false, verificationLayers: ['integration'],
    } },
  ] }] });
  assert.equal(result.approved, false);
  assert.ok(result.reasons.some(reason => reason.includes('passing verification evidence')));
});

test('V2: Worker-passing leaf evidence cannot substitute for parent integration', () => {
  const result = evaluateMissionCompletion({ milestones: [{ tasks: [
    { id: 'leaf', title: 'Create Skeleton component', description: '', status: 'done', evidenceHandoff: {
      taskId: 'leaf', status: 'done', worktree: '/repo', branch: 'ag/leaf', baseline: 'HEAD',
      changedPaths: ['src/components/Skeleton.tsx'],
      commandsAndResults: [{ command: 'npm test', exitCode: 0, summary: 'worker tests passed' }],
      knownFailuresOrSkips: [], commit: null, push: false, verificationLayers: ['task'],
    } },
    { id: 'integration', title: 'Final integration and verification', description: '', status: 'done', evidenceHandoff: {
      taskId: 'integration', status: 'done', worktree: '/repo', branch: 'ag/integration', baseline: 'HEAD',
      changedPaths: [], commandsAndResults: [{ command: 'npm test', exitCode: 0, summary: 'worker tests passed' }],
      knownFailuresOrSkips: [], commit: null, push: false, verificationLayers: ['task'],
    } },
  ] }] });
  assert.equal(result.approved, false);
});

test('V3: a failing runtime or build command blocks completion', () => {
  const result = evaluateMissionCompletion({ milestones: [{ tasks: [
    { id: 'leaf', title: 'Create component', description: '', status: 'done' },
    { id: 'integration', title: 'Final integration and verification', description: '', status: 'done', evidenceHandoff: {
      taskId: 'integration', status: 'done', worktree: '/repo', branch: 'ag/integration', baseline: 'HEAD',
      changedPaths: ['src/App.tsx'],
      commandsAndResults: [{ command: 'npm run build', exitCode: 1, summary: 'runtime verification failed' }],
      knownFailuresOrSkips: [], commit: null, push: false, verificationLayers: ['live'],
    } },
  ] }] });
  assert.equal(result.approved, false);
  assert.ok(result.reasons.some(reason => reason.includes('passing verification evidence')));
});
