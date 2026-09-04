import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { runRepositoryAudit } from '../dist/agent/repository-audit.js';

function git(root, args) {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
}

test('repository audit detects deleted tests and newly added dependencies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-audit-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: {} }));
  await fs.mkdir(path.join(root, 'tests'));
  await fs.writeFile(path.join(root, 'tests', 'old.test.mjs'), 'test');
  git(root, ['init']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'baseline']);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { newlib: '^1.0.0' } }));
  await fs.rm(path.join(root, 'tests', 'old.test.mjs'));

  const issues = await runRepositoryAudit(root);
  assert.equal(issues.some(issue => issue.type === 'deleted_test'), true);
  assert.equal(issues.some(issue => issue.type === 'new_dependency' && issue.message.includes('newlib')), true);
  await fs.rm(root, { recursive: true, force: true });
});
