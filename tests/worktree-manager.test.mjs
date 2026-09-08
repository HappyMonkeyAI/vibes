import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTaskWorktree,
  getTaskWorktreePath,
  removeTaskWorktree,
  isRepositoryClean,
  mergeDeclaredTaskFiles,
} from '../dist/agent/worktree-manager.js';

test('worktree paths and branches are deterministic and task-scoped', async () => {
  const calls = [];
  const result = await createTaskWorktree({
    repo: '/repo',
    taskId: 'task/one',
    baseRef: 'abc123',
    runGit: async (args, cwd) => {
      calls.push({ args, cwd });
      return { stdout: '', stderr: '' };
    },
  });

  assert.equal(result.branch, 'ag/task-one');
  assert.equal(result.path, '/repo/.worktrees/task-one');
  assert.deepEqual(calls, [{
    args: ['worktree', 'add', '--quiet', '/repo/.worktrees/task-one', '-b', 'ag/task-one', 'abc123'],
    cwd: '/repo',
  }]);
  assert.equal(getTaskWorktreePath('/repo', 'task/one'), '/repo/.worktrees/task-one');
});

test('worktree lifecycle removal is non-destructive by default', async () => {
  const calls = [];
  await removeTaskWorktree('/repo', 'task-1', async (args, cwd) => {
    calls.push({ args, cwd });
    return { stdout: '', stderr: '' };
  });

  assert.deepEqual(calls, [{
    args: ['worktree', 'remove', '/repo/.worktrees/task-1'],
    cwd: '/repo',
  }]);
});

test('task IDs cannot escape the repository worktree directory', () => {
  assert.throws(() => getTaskWorktreePath('/repo', '../outside'), /unsafe task id/);
});

test('clean preflight reflects actual porcelain status', async () => {
  assert.equal(await isRepositoryClean('/repo', async () => ({ stdout: '', stderr: '' })), true);
  assert.equal(await isRepositoryClean('/repo', async () => ({ stdout: ' M src/App.tsx\n', stderr: '' })), false);
});

test('merge rejects undeclared path traversal before any Git cleanup', async () => {
  await assert.rejects(
    mergeDeclaredTaskFiles({ repo: '/repo', taskId: 'task-1', files: ['../outside.ts'] }),
    /unsafe task file/,
  );
});
