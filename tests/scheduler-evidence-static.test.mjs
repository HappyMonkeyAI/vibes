import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Scheduler } from '../dist/agent/scheduler.js';
import { config, overrideConfig } from '../dist/config.js';

/**
 * Static HTML workspace (no package.json, no usable .git): evidence gate must
 * not invent `npm --version` / require git — that was failing desktop footer missions.
 */
test('static workspace evidence handoff succeeds without git or package.json', async () => {
  const previous = {
    ENABLE_ADVERSARIAL_AUDIT: config.ENABLE_ADVERSARIAL_AUDIT,
    ENABLE_REVIEWER: config.ENABLE_REVIEWER,
  };
  overrideConfig({ ENABLE_ADVERSARIAL_AUDIT: false, ENABLE_REVIEWER: false });

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-evidence-static-'));
  await fs.writeFile(path.join(root, 'index.html'), '<footer>© 2026</footer>\n');
  // Broken .git stub (HEAD only) — mirrors development/test failure mode.
  await fs.mkdir(path.join(root, '.git'));
  await fs.writeFile(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');

  const task = {
    id: 'footer',
    title: 'Add footer HTML structure',
    description: 'Add footer',
    files: ['index.html'],
    acceptance_criteria: ['footer exists'],
    depends_on: [],
    type: 'config',
    status: 'todo',
    attemptCount: 0,
  };
  const mission = {
    id: 'mission-static-evidence',
    title: 'Static footer',
    description: 'No npm / broken git',
    workspace_root: root,
    milestones: [{ id: 'm1', title: 'Work', description: 'Work', tasks: [task] }],
    status: 'planning',
  };

  const executor = {
    async executeTask(t) {
      return { ...t, status: 'done', output: 'added footer', error: undefined };
    },
  };

  const result = await new Scheduler(mission, executor).run();
  const done = result.milestones[0].tasks[0];
  assert.equal(done.status, 'done', `expected done, got ${done.status}: ${done.error ?? ''}`);
  assert.equal(result.status, 'completed');
  assert.equal(done.evidenceHandoff?.branch, 'no-git-workspace');

  await fs.rm(root, { recursive: true, force: true });
  overrideConfig(previous);
});
