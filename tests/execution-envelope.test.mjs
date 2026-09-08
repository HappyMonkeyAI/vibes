import assert from 'node:assert/strict';
import test from 'node:test';

import { createExecutionEnvelope } from '../dist/agent/types.js';

test('createExecutionEnvelope assigns stable identity and sequence metadata', () => {
  const event = { type: 'task_started', taskId: 'task-1', title: 'Write tests' };
  const envelope = createExecutionEnvelope(event, {
    runId: 'run-1',
    missionId: 'mission-1',
    taskId: 'task-1',
    attempt: 2,
    sequence: 7,
    actor: { kind: 'worker', id: 'worker-1' },
    timestamp: '2026-07-22T16:00:00.000Z',
  });

  assert.deepEqual(envelope, {
    version: 1,
    runId: 'run-1',
    missionId: 'mission-1',
    taskId: 'task-1',
    attempt: 2,
    sequence: 7,
    timestamp: '2026-07-22T16:00:00.000Z',
    actor: { kind: 'worker', id: 'worker-1' },
    event,
  });
});

test('createExecutionEnvelope defaults optional metadata without changing the event', () => {
  const event = { type: 'output', content: 'done' };
  const envelope = createExecutionEnvelope(event, {
    runId: 'run-2',
    missionId: 'mission-2',
    sequence: 0,
  });

  assert.equal(envelope.version, 1);
  assert.equal(envelope.attempt, 1);
  assert.equal(envelope.actor.kind, 'executor');
  assert.match(envelope.timestamp, /^20\d\d-/);
  assert.deepEqual(envelope.event, event);
});
