import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  composeRoleSystemPrompt,
  loadMissionOverlay,
  loadRoleConstitutions,
} from '../dist/agent/role-prompt-compose.js';

function tmpWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-t80-'));
  fs.mkdirSync(path.join(root, '.vibes'), { recursive: true });
  return root;
}

test('compose is no-op when sibling files missing', () => {
  const root = tmpWorkspace();
  const base = 'BASE_PROMPT';
  assert.equal(composeRoleSystemPrompt({ workspaceRoot: root, role: 'executor', basePrompt: base }), base);
});

test('compose prepends constitution with labeled SoT section (T80)', () => {
  const root = tmpWorkspace();
  fs.writeFileSync(
    path.join(root, '.vibes', 'role-constitutions.json'),
    JSON.stringify({
      v: 1,
      at: Date.now(),
      roles: {
        default: '',
        planner: '',
        executor: 'Never introduce React.',
        reviewer: '',
        triage: '',
      },
    }),
  );

  const out = composeRoleSystemPrompt({
    workspaceRoot: root,
    role: 'executor',
    basePrompt: 'BASE',
  });

  assert.match(out, /OPERATOR CONSTITUTION \(executor\)/);
  assert.match(out, /Never introduce React/);
  assert.ok(out.endsWith('BASE'));
  assert.ok(out.indexOf('Never introduce React') < out.indexOf('BASE'));
});

test('executor falls back to default constitution', () => {
  const root = tmpWorkspace();
  fs.writeFileSync(
    path.join(root, '.vibes', 'role-constitutions.json'),
    JSON.stringify({
      v: 1,
      roles: { default: 'DEFAULT_CONST', planner: '', executor: '', reviewer: '', triage: '' },
    }),
  );
  const out = composeRoleSystemPrompt({ workspaceRoot: root, role: 'planner', basePrompt: 'P' });
  assert.match(out, /DEFAULT_CONST/);
});

test('overlay appends add/emphasize/forbid without rewriting constitution', () => {
  const root = tmpWorkspace();
  fs.writeFileSync(
    path.join(root, '.vibes', 'role-constitutions.json'),
    JSON.stringify({ v: 1, roles: { executor: 'CONST_SO_T', default: '', planner: '', reviewer: '', triage: '' } }),
  );
  fs.writeFileSync(
    path.join(root, '.vibes', 'mission-overlay.json'),
    JSON.stringify({
      v: 1,
      patches: [
        { op: 'forbid', text: 'No PHP thisorthat' },
        { op: 'emphasize', text: 'Plan exactly 1 task' },
        { op: 'add', text: 'Ship Enter VR toast' },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(root, '.vibes', 'role-lessons.json'),
    JSON.stringify({
      v: 1,
      roles: { executor: ['Run npm install before evidence'], default: [] },
    }),
  );

  const out = composeRoleSystemPrompt({ workspaceRoot: root, role: 'executor', basePrompt: 'BASE' });
  assert.match(out, /CONST_SO_T/);
  assert.match(out, /MISSION OVERLAY/);
  assert.match(out, /FORBID: No PHP thisorthat/);
  assert.match(out, /EMPHASIZE: Plan exactly 1 task/);
  assert.match(out, /ADD: Ship Enter VR toast/);
  assert.match(out, /ROLE LESSONS/);
  assert.match(out, /Run npm install before evidence/);
  assert.ok(out.indexOf('CONST_SO_T') < out.indexOf('MISSION OVERLAY'));
  assert.ok(out.indexOf('MISSION OVERLAY') < out.indexOf('ROLE LESSONS'));
});

test('load helpers tolerate corrupt JSON', () => {
  const root = tmpWorkspace();
  fs.writeFileSync(path.join(root, '.vibes', 'role-constitutions.json'), '{not-json');
  fs.writeFileSync(path.join(root, '.vibes', 'mission-overlay.json'), '{not-json');
  assert.equal(loadRoleConstitutions(root), null);
  assert.equal(loadMissionOverlay(root), null);
  assert.equal(
    composeRoleSystemPrompt({ workspaceRoot: root, role: 'executor', basePrompt: 'X' }),
    'X',
  );
});
