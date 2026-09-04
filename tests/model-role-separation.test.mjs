import assert from 'node:assert/strict';
import test from 'node:test';

import { validateReviewerModelSeparation } from '../dist/agent/reviewer.js';

test('accepts distinct executor and reviewer models', () => {
  assert.deepEqual(
    validateReviewerModelSeparation('qwen-coder-9b', 'gemma-27b'),
    { independent: true },
  );
});

test('rejects identical model roles after normalization', () => {
  const result = validateReviewerModelSeparation(' Qwen-Coder-9B ', 'qwen-coder-9b');
  assert.equal(result.independent, false);
  assert.match(result.reason, /same model/i);
});

test('rejects missing reviewer or executor model identity', () => {
  assert.equal(validateReviewerModelSeparation('', 'gemma-27b').independent, false);
  assert.equal(validateReviewerModelSeparation('qwen-9b', '').independent, false);
});
