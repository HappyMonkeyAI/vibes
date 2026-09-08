import assert from 'node:assert/strict';
import test from 'node:test';

import { Scheduler } from '../dist/agent/scheduler.js';

function missionWith(workspaceRoot) {
  return {
    id: 'mission-approval',
    title: 'Approval',
    description: 'd',
    workspace_root: workspaceRoot,
    milestones: [],
    status: 'executing',
  };
}

const stubExecutor = { executeTask: async task => task };

/** Requests are queued, so the prompt for one lands a microtask after it is asked for. */
const tick = () => new Promise(resolve => setImmediate(resolve));

test('concurrent approval requests are answered one at a time, never stranded', async () => {
  const events = [];
  const scheduler = new Scheduler(missionWith(process.cwd()), stubExecutor, evt => events.push(evt));

  const first = scheduler.requestToolApproval({ tool: 'shell', reason: 'r1', preview: '{}' });
  const second = scheduler.requestToolApproval({ tool: 'write_file', reason: 'r2', preview: '{}' });
  await tick();

  // Only the first prompt is live; the second is queued behind it.
  assert.equal(events.filter(e => e.type === 'approval_required').length, 1);

  scheduler.resolveToolApproval(true);
  assert.equal(await first, true);
  await tick();

  assert.equal(events.filter(e => e.type === 'approval_required').length, 2);

  scheduler.resolveToolApproval(false);
  assert.equal(await second, false);

  assert.deepEqual(
    events.filter(e => e.type === 'approval_resolved').map(e => [e.tool, e.approved]),
    [['shell', true], ['write_file', false]],
  );
});

test('aborting denies the in-flight request and everything queued behind it', async () => {
  const scheduler = new Scheduler(missionWith(process.cwd()), stubExecutor, () => {});

  const first = scheduler.requestToolApproval({ tool: 'shell', reason: 'r', preview: '{}' });
  const second = scheduler.requestToolApproval({ tool: 'shell', reason: 'r', preview: '{}' });
  await tick();

  scheduler.abortPendingApproval();

  assert.equal(await first, false);
  assert.equal(await second, false);
});

test('mission status is restored after an approval resolves', async () => {
  const scheduler = new Scheduler(missionWith(process.cwd()), stubExecutor, () => {});

  const pending = scheduler.requestToolApproval({ tool: 'shell', reason: 'r', preview: '{}' });
  await tick();
  assert.equal(scheduler.mission.status, 'awaiting_intervention');

  scheduler.resolveToolApproval(true);
  await pending;
  assert.equal(scheduler.mission.status, 'executing');
});
