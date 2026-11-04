import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkCommand,
  isSpawnFailure,
  resolveShell,
  shellCatchResult,
  shellTool,
} from '../dist/tools/shell-tool.js';

test('resolveShell never hardcodes /bin/bash on win32', () => {
  const shell = resolveShell('win32');
  if (typeof shell === 'string') {
    assert.notEqual(shell, '/bin/bash');
    assert.match(shell, /cmd\.exe|powershell|pwsh/i);
  } else {
    assert.equal(shell, undefined);
  }
});

test('resolveShell prefers /bin/bash on unix when present', () => {
  if (process.platform === 'win32') return;
  const shell = resolveShell('linux');
  if (fs.existsSync('/bin/bash')) assert.equal(shell, '/bin/bash');
  else assert.equal(shell, undefined);
});

test('isSpawnFailure detects ENOENT spawn errors', () => {
  assert.equal(isSpawnFailure({ code: 'ENOENT', message: 'spawn /bin/bash ENOENT' }), true);
  assert.equal(isSpawnFailure({ code: 1, message: 'Command failed' }), false);
  assert.equal(isSpawnFailure({ code: 2, message: 'grep: no matches' }), false);
});

test('checkCommand still blocks rm -rf', () => {
  assert.ok(checkCommand('rm -rf /tmp/x'));
});

test('shell tool runs a trivial command on this host', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-shell-'));
  const result = await shellTool.execute(
    {
      command: 'echo ok',
      timeout: 10000,
      failOnError: true,
    },
    { workspaceRoot: dir },
  );
  assert.equal(result.success, true, result.error);
  assert.match(String(result.data?.stdout ?? ''), /ok/);
});

test('shellCatchResult: bash ENOENT is never soft-success (T88 dogfood)', () => {
  const result = shellCatchResult(
    { code: 'ENOENT', message: 'spawn /bin/bash ENOENT', stdout: '', stderr: '' },
    false,
  );
  assert.equal(result.success, false);
  assert.equal(result.data?.spawnFailed, true);
  assert.match(String(result.error), /ENOENT/);
});

test('shellCatchResult: non-zero exit can soft-succeed when failOnError=false', () => {
  const result = shellCatchResult(
    { code: 1, message: 'Command failed: grep', stdout: '', stderr: 'no match' },
    false,
  );
  assert.equal(result.success, true);
  assert.equal(result.data?.exitCode, 1);
});

test('shell tool runs echo on Windows without /bin/bash', async () => {
  if (process.platform !== 'win32') return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-shell-'));
  const result = await shellTool.execute(
    { command: 'echo windows-shell-ok', timeout: 10000, failOnError: true },
    { workspaceRoot: dir },
  );
  assert.equal(result.success, true, result.error);
  assert.match(String(result.data?.stdout ?? ''), /windows-shell-ok/i);
});
