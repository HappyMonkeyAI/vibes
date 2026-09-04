import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLiveEvent, applyLiveEvents, createLiveEventState, flushLiveEventState } from '../dist/tui/event-view-model.js';

test('live event model coalesces deltas without mutating completed history', () => {
  const initial = createLiveEventState();
  const thinking = applyLiveEvent(initial, { type: 'thinking_delta', content: 'one' });
  const output = applyLiveEvent(thinking, { type: 'output_delta', content: 'done' });
  const completed = applyLiveEvent(output, { type: 'task_completed', taskId: 't', title: 'T' });

  assert.equal(initial.completed.length, 0);
  assert.equal(completed.activeThinking, 'one');
  assert.equal(completed.activeOutput, 'done');
  assert.equal(completed.completed.length, 1);
  assert.equal(flushLiveEventState(completed).backlog, 0);
});

test('applyLiveEvents folds a whole flush batch in one pass', () => {
  const batch = [
    { type: 'thinking_delta', content: 'a' },
    { type: 'thinking_delta', content: 'b' },
    { type: 'output_delta', content: 'x' },
    { type: 'task_started', taskId: 't', title: 'T' },
    { type: 'output_delta', content: 'y' },
  ];
  const state = applyLiveEvents(createLiveEventState(), batch);

  assert.equal(state.activeThinking, 'ab');
  assert.equal(state.activeOutput, 'xy');
  assert.equal(state.backlog, 5);
  assert.deepEqual(state.completed.map(event => event.type), ['task_started']);
});

test('completed history stays bounded and keeps the newest events', () => {
  const batch = Array.from({ length: 30 }, (_, i) => ({ type: 'output', content: String(i) }));
  const state = applyLiveEvents(createLiveEventState(), batch, 10);

  assert.equal(state.completed.length, 10);
  assert.equal(state.completed[0].content, '20');
  assert.equal(state.completed.at(-1).content, '29');
});

test('a batch with no completed events reuses the existing history array', () => {
  const base = applyLiveEvents(createLiveEventState(), [{ type: 'output', content: 'seed' }]);
  const next = applyLiveEvents(base, [{ type: 'thinking_delta', content: 'x' }]);
  assert.equal(next.completed, base.completed);
});
