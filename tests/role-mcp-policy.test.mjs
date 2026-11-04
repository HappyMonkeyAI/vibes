import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applyRoleToolPolicy,
  loadRoleMcpPolicy,
  mcpServerFromToolName,
  policyForRole,
} from '../dist/mcp/role-mcp-policy.js';

function tool(name) {
  return {
    name,
    description: name,
    parameters: {},
    execute: async () => ({ success: true }),
  };
}

test('mcpServerFromToolName prefers longest known server', () => {
  assert.equal(
    mcpServerFromToolName('mcp_html-design-advisor_review', ['html-design-advisor', 'html']),
    'html-design-advisor',
  );
});

test('applyRoleToolPolicy filters servers and tools then budgets', () => {
  const tools = [
    tool('list_dir'),
    tool('read_file'),
    tool('mcp_alpha_ping'),
    tool('mcp_beta_pong'),
    tool('mcp_alpha_extra'),
  ];
  const out = applyRoleToolPolicy(tools, {
    servers: ['alpha'],
    tools: ['ping', 'list_dir', 'read_file'],
    toolBudget: 3,
  });
  assert.deepEqual(
    out.map((t) => t.name),
    ['list_dir', 'read_file', 'mcp_alpha_ping'],
  );
});

test('empty allowlists only apply budget (builtins first)', () => {
  const tools = [
    tool('a'),
    tool('b'),
    tool('mcp_x_one'),
    tool('mcp_x_two'),
  ];
  const out = applyRoleToolPolicy(tools, {
    servers: [],
    tools: [],
    toolBudget: 3,
  });
  assert.deepEqual(
    out.map((t) => t.name),
    ['a', 'b', 'mcp_x_one'],
  );
});

test('loadRoleMcpPolicy reads desktop T84 file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-policy-'));
  try {
    fs.mkdirSync(path.join(dir, '.vibes'));
    fs.writeFileSync(
      path.join(dir, '.vibes', 'role-mcp-policy.json'),
      JSON.stringify({
        v: 1,
        roles: {
          executor: {
            servers: ['html-design-advisor'],
            tools: [],
            toolBudget: 8,
            toolBudgetMode: 'manual',
          },
        },
      }),
    );
    const file = loadRoleMcpPolicy(dir);
    const policy = policyForRole(file, 'executor');
    assert.equal(policy?.toolBudget, 8);
    assert.deepEqual(policy?.servers, ['html-design-advisor']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
