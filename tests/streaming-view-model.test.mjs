import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLiveEvent, createLiveEventState, flushLiveEventState } from '../dist/tui/event-view-model.js';

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
