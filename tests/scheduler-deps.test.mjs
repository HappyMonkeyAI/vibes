import assert from 'node:assert/strict';
import test from 'node:test';

import { describeDependencyDeadlock } from '../dist/agent/scheduler-deps.js';

test('describeDependencyDeadlock detects circular pending dependencies', () => {
  const tasks = [
    { id: 'card', title: 'Create Card', status: 'todo', depends_on: ['style'] },
    { id: 'badge', title: 'Create Badge', status: 'todo', depends_on: ['card'] },
    { id: 'style', title: 'Add Component Styling', status: 'todo', depends_on: ['card', 'badge'] },
  ];
  const message = describeDependencyDeadlock(tasks, new Set());
  assert.match(message, /Scheduler deadlock/i);
  assert.match(message, /Create Card/);
  assert.match(message, /Add Component Styling/);
  assert.match(message, /circular depends_on/i);
});

test('describeDependencyDeadlock returns null when a task is runnable', () => {
  const tasks = [
    { id: 'card', title: 'Create Card', status: 'todo', depends_on: [] },
    { id: 'style', title: 'Add Component Styling', status: 'todo', depends_on: ['card'] },
  ];
  assert.equal(describeDependencyDeadlock(tasks, new Set()), null);
});