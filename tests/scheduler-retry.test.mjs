import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Scheduler } from '../dist/agent/scheduler.js';
import { config, overrideConfig } from '../dist/config.js';

function makeTask(id, title, depends_on = []) {
  return {
    id,
    title,
    description: title,
    files: ['package.json'],
    acceptance_criteria: ['The task completes'],
    depends_on,
    type: 'config',
    status: 'todo',
    attemptCount: 0,
  };
}

test('retry resets the failed task instead of restoring its stale failed object', async () => {
  const previousAdversarialAudit = config.ENABLE_ADVERSARIAL_AUDIT;
  overrideConfig({ ENABLE_ADVERSARIAL_AUDIT: false });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-scheduler-retry-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'retry-fixture' }));

  const first = makeTask('first', 'First task');
  const second = makeTask('second', 'Second task', ['first']);
  const integration = makeTask('integration', 'Final integration and verification', ['second']);
  const mission = {
    id: 'mission-retry',
    title: 'Retry mission',
    description: 'Exercise retry scheduling',
    workspace_root: root,
    milestones: [{ id: 'milestone', title: 'Work', description: 'Work', tasks: [first, second, integration] }],
    status: 'planning',
  };

  let executions = 0;
  let scheduler;
  const events = [];
  const executor = {
    async executeTask(task) {
      executions += 1;
      if (task.id === 'first' && executions === 1) {
        return { ...task, status: 'failed', error: 'synthetic failure' };
      }
      return {
        ...task,
        status: 'done',
        output: 'completed',
        ...(task.id === 'integration' ? {
          evidenceHandoff: {
            taskId: 'integration',
            status: 'done',
            worktree: root,
            branch: 'ag/integration',
            baseline: 'HEAD',
            changedPaths: ['package.json'],
            commandsAndResults: [{ command: 'npm test', exitCode: 0, summary: 'passed' }],
            knownFailuresOrSkips: [],
            commit: null,
            push: false,
            verificationLayers: ['integration'],
          },
        } : {}),
      };
    },
  };

  scheduler = new Scheduler(mission, executor, (event) => {
    events.push(event);
    if (event.type === 'intervention_required') {
      scheduler.resolveIntervention({ action: 'retry' });
    }
  });
  const result = await scheduler.run();

  assert.equal(result.status, 'completed');
  assert.equal(executions, 4);
  assert.deepEqual(
    result.milestones[0].tasks.map((task) => task.status),
    ['done', 'done', 'done'],
  );
  assert.equal(events.filter((event) => event.type === 'task_started').length, 4);
  assert.equal(events.some((event) => event.type === 'task_failed' && event.taskId === 'first'), true);

  await fs.rm(root, { recursive: true, force: true });
  overrideConfig({ ENABLE_ADVERSARIAL_AUDIT: previousAdversarialAudit });
});
