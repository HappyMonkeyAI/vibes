import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  composeBeforeToolCallHooks,
  createStackFenceHook,
  detectStackPolicy,
  evaluateStackFence,
  stackFencePlannerNote,
} from '../dist/agent/stack-fence.js';
import { detectTechStack } from '../dist/agent/tech-stack.js';

function tempWorkspace(pkg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-fence-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  return dir;
}

test('detectStackPolicy: three without react is vanilla-three', () => {
  const dir = tempWorkspace({
    dependencies: { three: '^0.185.0' },
    devDependencies: { typescript: '^5.9.0', vite: '^7.0.0' },
  });
  assert.equal(detectStackPolicy(dir), 'vanilla-three');
  assert.match(stackFencePlannerNote(dir), /STACK FENCE/);
});

test('detectStackPolicy: react dep is react', () => {
  const dir = tempWorkspace({
    dependencies: { react: '^19.0.0', three: '^0.185.0' },
  });
  assert.equal(detectStackPolicy(dir), 'react');
  assert.equal(stackFencePlannerNote(dir), '');
});

test('vanilla-three fence denies .tsx writes and react imports', () => {
  const deniedPath = evaluateStackFence(
    { tool: 'file_write', args: { path: 'src/ui/rankedGallery.tsx', content: 'export {}' } },
    'vanilla-three',
  );
  assert.equal(deniedPath?.decision, 'deny');

  const deniedImport = evaluateStackFence(
    {
      tool: 'file_write',
      args: { path: 'src/main.ts', content: "import React from 'react';\n" },
    },
    'vanilla-three',
  );
  assert.equal(deniedImport?.decision, 'deny');

  const deniedShell = evaluateStackFence(
    { tool: 'shell', args: { command: 'npm install react react-dom' } },
    'vanilla-three',
  );
  assert.equal(deniedShell?.decision, 'deny');
});

test('vanilla-three fence allows normal three/ts edits', () => {
  const ok = evaluateStackFence(
    {
      tool: 'file_write',
      args: {
        path: 'src/rankedGallery.ts',
        content: "import * as THREE from 'three';\nexport const x = 1;\n",
      },
    },
    'vanilla-three',
  );
  assert.equal(ok, null);

  const readOk = evaluateStackFence(
    { tool: 'file_read', args: { path: 'src/main.tsx' } },
    'vanilla-three',
  );
  assert.equal(readOk, null);
});

test('react policy does not fence react writes', () => {
  const ok = evaluateStackFence(
    { tool: 'file_write', args: { path: 'src/App.tsx', content: "import React from 'react';\n" } },
    'react',
  );
  assert.equal(ok, null);
});

test('createStackFenceHook blocks mutating react calls for vanilla-three workspaces', async () => {
  const dir = tempWorkspace({ dependencies: { three: '0.185.0' } });
  const hook = createStackFenceHook(dir);
  const blocked = await hook({
    toolCall: { function: { name: 'file_write' } },
    args: { path: 'src/App.tsx', content: 'x' },
    assistantMessage: {},
    context: {},
  });
  assert.equal(blocked?.block, true);
  assert.match(String(blocked?.reason), /Stack fence/);
});

test('composeBeforeToolCallHooks: fence runs before approval', async () => {
  let approvalCalled = false;
  const composed = composeBeforeToolCallHooks(
    async () => ({ block: true, reason: 'fence' }),
    async () => {
      approvalCalled = true;
      return undefined;
    },
  );
  const result = await composed({
    toolCall: { function: { name: 'file_write' } },
    args: {},
    assistantMessage: {},
    context: {},
  });
  assert.deepEqual(result, { block: true, reason: 'fence' });
  assert.equal(approvalCalled, false);
});

test('detectTechStack: stray .tsx does not invent react when package has three only', () => {
  const dir = tempWorkspace({
    dependencies: { three: '^0.185.0' },
    devDependencies: { typescript: '^5.9.0' },
  });
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'junk.tsx'), 'export {}\n');
  const stack = detectTechStack(dir);
  assert.ok(stack.includes('three'));
  assert.ok(stack.includes('vanilla-three'));
  assert.ok(!stack.includes('react'));
});
