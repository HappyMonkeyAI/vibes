import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReviewerPrompts } from '../dist/agent/reviewer.js';

test('review prompt scopes rejection to the task criteria', () => {
  const { systemPrompt, userPrompt } = buildReviewerPrompts(
    {
      title: 'Create SkeletonRect',
      description: 'Create the rectangular skeleton shape.',
      acceptance_criteria: ['Exports SkeletonRect', 'Accepts width and height props'],
      output: 'Implemented the rectangular shape.',
    },
    { title: 'Loading skeleton feature' },
    'diff -- src/SkeletonRect.tsx',
    '',
  );

  assert.match(systemPrompt, /only reject.*task's own acceptance criteria/i);
  assert.match(systemPrompt, /do not require mission-wide integration/i);
  assert.match(userPrompt, /Task-scoped review boundary/i);
  assert.doesNotMatch(userPrompt, /Suspense integration/);
});
