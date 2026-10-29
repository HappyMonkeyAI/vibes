import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Compiled JS after build; also allow running against dist when present.
let resolveShellExecutable;
let isShellSpawnFailure;
try {
  ({ resolveShellExecutable, isShellSpawnFailure } = await import('../dist/tools/shell-tool.js'));
} catch {
  // Fallback if dist not built yet in some environments
  ({ resolveShellExecutable, isShellSpawnFailure } = require('../dist/tools/shell-tool.js'));
}

test('resolveShellExecutable never returns /bin/bash on win32', () => {
  if (process.platform !== 'win32') {
    assert.equal(resolveShellExecutable(), '/bin/bash');
    return;
  }
  const shell = resolveShellExecutable();
  assert.notEqual(shell, '/bin/bash');
  assert.match(shell.toLowerCase(), /cmd\.exe$/);
});

test('isShellSpawnFailure detects ENOENT spawn errors', () => {
  assert.equal(isShellSpawnFailure({ code: 'ENOENT', message: 'spawn /bin/bash ENOENT' }), true);
  assert.equal(isShellSpawnFailure({ message: 'spawn C:\\Windows\\System32\\cmd.exe ENOENT' }), true);
  assert.equal(isShellSpawnFailure({ code: 1, message: 'Command failed: npm test' }), false);
  assert.equal(isShellSpawnFailure({ code: 'ETIMEDOUT', message: 'timed out' }), false);
});
