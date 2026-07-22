import assert from 'node:assert/strict';
import test from 'node:test';

import { decideApproval } from '../dist/agent/approval-policy.js';

test('approval policy allows reads and denies explicit patterns before mode logic', () => {
  assert.equal(decideApproval({ tool: 'file_read', args: { path: 'README.md' } }).decision, 'allow');
  assert.equal(decideApproval({ tool: 'shell', args: { command: 'rm -rf /' } }, { mode: 'yolo', denyPatterns: ['rm\\s+-rf'] }).decision, 'deny');
});

test('approval policy keeps shell approval explicit and plan mode fail-closed', () => {
  assert.equal(decideApproval({ tool: 'shell', args: { command: 'npm test' } }).decision, 'ask');
  assert.equal(decideApproval({ tool: 'write_file', args: { path: 'x' } }, { mode: 'plan' }).decision, 'deny');
  assert.equal(decideApproval({ tool: 'write_file', args: { path: 'x' } }, { mode: 'auto-edit' }).decision, 'allow');
});
