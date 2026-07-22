import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCompletionReceipt } from '../dist/agent/completion-receipt.js';

test('completion receipt accepts claims backed by changed files and verification evidence', () => {
  const result = validateCompletionReceipt({
    v: 1,
    task: 'add feature',
    status: 'complete',
    claims: [
      { type: 'modified', file: 'src/feature.ts' },
      { type: 'build_pass', command: 'npm run build', exitCode: 0 },
    ],
  }, {
    changedFiles: ['src/feature.ts'],
    verificationCommands: [{ command: 'npm run build', exitCode: 0 }],
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('completion receipt rejects claims that reality does not support', () => {
  const result = validateCompletionReceipt({
    v: 1,
    task: 'add feature',
    status: 'complete',
    claims: [
      { type: 'created', file: 'src/missing.ts' },
      { type: 'tests_pass', command: 'npm test', exitCode: 0 },
    ],
  }, {
    changedFiles: ['src/feature.ts'],
    verificationCommands: [{ command: 'npm test', exitCode: 1 }],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /missing\.ts/);
  assert.match(result.errors.join('\n'), /npm test/);
});
