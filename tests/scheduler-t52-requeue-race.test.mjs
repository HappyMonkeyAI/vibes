import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Scheduler } from '../dist/agent/scheduler.js';
import { config, overrideConfig } from '../dist/config.js';

/**
 * T52: soft verification requeue must not delete runningTasks before executeTask
 * finally — that raced a second start and left status=in_progress with no runner
 * (deadlock message with empty blocked titles).
 */
test('T52 verification soft-requeue completes without Mission Scheduler deadlock', async () => {
  const previous = {
    ENABLE_ADVERSARIAL_AUDIT: config.ENABLE_ADVERSARIAL_AUDIT,
    ENABLE_REVIEWER: config.ENABLE_REVIEWER,
  };
  overrideConfig({ ENABLE_ADVERSARIAL_AUDIT: false, ENABLE_REVIEWER: false });

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-t52-requeue-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 't52-fixture' }));

  const task = {
    id: 'marker',
    title: 'Add marker file',
    description: 'Create marker.txt',
    files: ['marker.txt'],
    acceptance_criteria: ['marker.txt exists'],
    depends_on: [],
    type: 'config',
    status: 'todo',
    attemptCount: 0,
  };
  const mission = {
    id: 'mission-t52',
    title: 'T52 soft requeue',
    description: 'Verify soft-requeue race fix',
    workspace_root: root,
    milestones: [{ id: 'm1', title: 'Work', description: 'Work', tasks: [task] }],
    status: 'planning',
  };

  let executions = 0;
  const events = [];
  const executor = {
    async executeTask(current) {
      executions += 1;
      if (executions === 1) {
        // Claim done without writing the file → goal judge fails → soft requeue.
        return { ...current, status: 'done', output: 'pretended write', error: undefined };
      }
      await fs.writeFile(path.join(root, 'marker.txt'), 'ok\n');
      return {
        ...current,
        status: 'done',
        output: 'wrote marker.txt',
        evidenceHandoff: {
          taskId: current.id,
          status: 'done',
          worktree: root,
          branch: 'ag/marker',
          baseline: 'HEAD',
          changedPaths: ['marker.txt'],
          commandsAndResults: [{ command: 'workspace-check', exitCode: 0, summary: 'ok' }],
          knownFailuresOrSkips: [],
          commit: null,
          push: false,
          verificationLayers: ['unit'],
        },
      };
    },
  };

  const scheduler = new Scheduler(mission, executor, (event) => {
    events.push(event);
    if (event.type === 'intervention_required') {
      scheduler.resolveIntervention({ action: 'fail' });
    }
  });
  const result = await scheduler.run();

  assert.equal(result.status, 'completed', `expected completed, got ${result.status}`);
  assert.ok(executions >= 2, `expected at least 2 executions after soft requeue, got ${executions}`);
  assert.equal(
    events.some((e) => e.type === 'task_failed' && e.title === 'Mission Scheduler'),
    false,
    'must not emit Mission Scheduler deadlock',
  );
  assert.equal(result.milestones[0].tasks[0].status, 'done');

  await fs.rm(root, { recursive: true, force: true });
  overrideConfig(previous);
});
