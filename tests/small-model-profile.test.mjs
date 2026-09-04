import assert from 'node:assert/strict';
import test from 'node:test';

import { getSmallModelRuntimeProfile } from '../dist/agent/model-prompts.js';

test('small-model profile is opt-in and raises the step budget', () => {
  assert.equal(getSmallModelRuntimeProfile('qwythos-9b-claude-mythos-5-1m', false), null);
  assert.deepEqual(getSmallModelRuntimeProfile('qwythos-9b-claude-mythos-5-1m', true), {
    maxSteps: 20,
    maxConcurrentTasks: 1,
    compactContext: true,
  });
});

test('small-model profile does not apply to large models', () => {
  assert.equal(getSmallModelRuntimeProfile('qwen-27b', true), null);
});
