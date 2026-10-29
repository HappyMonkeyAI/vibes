import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Scheduler } from '../dist/agent/scheduler.js';
import { config, overrideConfig } from '../dist/config.js';

/**
 * Regression: evidence-handoff failure must not leave status=done without
 * completedTasks credit — that ghosts dependents into a false deadlock.
 */
test('evidence handoff failure requeues done work instead of ghost-completing it', async () => {
  const previous = {
    ENABLE_ADVERSARIAL_AUDIT: config.ENABLE_ADVERSARIAL_AUDIT,
    ENABLE_REVIEWER: config.ENABLE_REVIEWER,
  };
  overrideConfig({ ENABLE_ADVERSARIAL_AUDIT: false, ENABLE_REVIEWER: false });

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-evidence-requeue-'));
  // Failing build makes attachEvidenceHandoff return false when no handoff is attached.
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'evidence-requeue-fixture',
      scripts: { build: 'node -e "process.exit(1)"' },
    }),
  );

  const first = {
    id: 'html',
    title: 'Create HTML structure',
    description: 'Create HTML structure',
    files: ['package.json'],
    acceptance_criteria: ['package.json exists'],
    depends_on: [],
    type: 'config',
    status: 'todo',
    attemptCount: 0,
  };
  const second = {
    id: 'css',
    title: 'Add CSS styling',
    description: 'Add CSS styling',
    files: ['package.json'],
    acceptance_criteria: ['package.json exists'],
    depends_on: ['html'],
    type: 'config',
    status: 'todo',
    attemptCount: 0,
  };
  const integration = {
    id: 'integration',
    title: 'Final integration and verification',
    description: 'Wire and verify',
    files: ['package.json'],
    acceptance_criteria: ['package.json exists'],
    depends_on: ['html', 'css'],
    type: 'config',
    status: 'todo',
    attemptCount: 0,
  };
  const mission = {
    id: 'mission-evidence-requeue',
    title: 'Evidence requeue',
    description: 'Gate failure must requeue',
    workspace_root: root,
    milestones: [{ id: 'm1', title: 'Work', description: 'Work', tasks: [first, second, integration] }],
    status: 'planning',
  };

  let executions = 0;
  const executor = {
    async executeTask(task) {
      executions += 1;
      if (task.id === 'html' && executions === 1) {
        // Done from the executor, but no evidence handoff → gate fails → requeue.
        return { ...task, status: 'done', output: 'wrote structure', error: undefined };
      }
      if (task.id === 'html') {
        // Second attempt: attach a valid handoff so the gate short-circuits.
        return {
          ...task,
          status: 'done',
          output: 'wrote structure',
          evidenceHandoff: {
            taskId: 'html',
            status: 'done',
            worktree: root,
            branch: 'ag/html',
            baseline: 'HEAD',
            changedPaths: ['package.json'],
            commandsAndResults: [{ command: 'npm --version', exitCode: 0, summary: 'passed' }],
            knownFailuresOrSkips: [],
            commit: null,
            push: false,
            verificationLayers: ['unit'],
          },
        };
      }
      return {
        ...task,
        status: 'done',
        output: task.id === 'integration' ? 'verified' : 'styled',
        evidenceHandoff: {
          taskId: task.id,
          status: 'done',
          worktree: root,
          branch: `ag/${task.id}`,
          baseline: 'HEAD',
          changedPaths: ['package.json'],
          commandsAndResults: [{ command: 'npm --version', exitCode: 0, summary: 'passed' }],
          knownFailuresOrSkips: [],
          commit: null,
          push: false,
          verificationLayers: task.id === 'integration' ? ['integration'] : ['unit'],
        },
      };
    },
  };

  const scheduler = new Scheduler(mission, executor);
  const result = await scheduler.run();

  assert.ok(executions >= 4, `expected html re-run + css + integration, got ${executions} executions`);
  const html = result.milestones[0].tasks.find((t) => t.id === 'html');
  const css = result.milestones[0].tasks.find((t) => t.id === 'css');
  const final = result.milestones[0].tasks.find((t) => t.id === 'integration');
  assert.equal(html.status, 'done', 'html must finish after requeue (not ghost-done)');
  assert.equal(css.status, 'done', 'css must run — proves html was credited after requeue');
  assert.equal(final.status, 'done');
  assert.equal(result.status, 'completed');

  await fs.rm(root, { recursive: true, force: true });
  overrideConfig(previous);
});
