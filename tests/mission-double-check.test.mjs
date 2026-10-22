import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDoubleCheckOwnerPrompt,
  doubleCheckMissionEvidence,
} from '../dist/agent/mission-double-check.js';
import { buildOwnerAdversaryPrompt } from '../dist/agent/reviewer.js';

const handoff = {
  taskId: 'integration',
  status: 'done',
  worktree: '/repo',
  branch: 'ag/integration',
  baseline: 'HEAD',
  changedPaths: ['index.html'],
  commandsAndResults: [{ command: 'echo ok', exitCode: 0, summary: 'ok' }],
  knownFailuresOrSkips: [],
  commit: null,
  push: false,
  verificationLayers: ['integration'],
};

test('owner adversary userPrompt uses real newlines (not literal \\n)', () => {
  const { userPrompt } = buildOwnerAdversaryPrompt(
    { title: 'Header', description: 'Add a dark header' },
    [{ title: 'HTML', acceptance_criteria: ['nav exists'] }],
    'diff -- index.html',
  );
  assert.ok(userPrompt.includes('\nOriginal request:\n'), 'expected newline-separated sections');
  assert.equal(userPrompt.includes('\\nOriginal'), false);
});

test('owner adversary systemPrompt asks for a re-check before approve', () => {
  const { systemPrompt } = buildOwnerAdversaryPrompt(
    { title: 'Header', description: 'Add a dark header' },
    [{ title: 'HTML', acceptance_criteria: ['nav exists'] }],
    'diff -- index.html',
  );
  assert.match(systemPrompt, /hasty first pass|re-check each criterion/i);
});

test('double-check passes when declared files exist and handoff has changes', () => {
  const result = doubleCheckMissionEvidence(
    {
      title: 'Header',
      description: 'dark header + menu',
      workspace_root: 'C:/workspace',
      milestones: [{
        tasks: [
          { title: 'HTML', status: 'done', files: ['index.html'], evidenceHandoff: undefined },
          { title: 'Final integration and verification', status: 'done', files: [], evidenceHandoff: handoff },
        ],
      }],
    },
    {
      fileExists: (p) => p.replace(/\\/g, '/').endsWith('index.html'),
      fileSize: () => 120,
    },
  );
  assert.equal(result.approved, true, result.reasons.join('; '));
});

test('double-check rejects missing declared files', () => {
  const result = doubleCheckMissionEvidence(
    {
      title: 'Header',
      description: 'dark header',
      workspace_root: 'C:/workspace',
      milestones: [{
        tasks: [
          { title: 'HTML', status: 'done', files: ['index.html', 'missing.css'] },
          { title: 'Final integration and verification', status: 'done', files: [], evidenceHandoff: handoff },
        ],
      }],
    },
    {
      fileExists: (p) => p.replace(/\\/g, '/').endsWith('index.html'),
      fileSize: () => 40,
    },
  );
  assert.equal(result.approved, false);
  assert.ok(result.reasons.some((r) => /missing/i.test(r) && /missing\.css/.test(r)));
});

test('double-check rejects empty required files', () => {
  const result = doubleCheckMissionEvidence(
    {
      title: 'Header',
      description: 'dark header',
      workspace_root: '/repo',
      milestones: [{
        tasks: [{ title: 'HTML', status: 'done', files: ['index.html'], evidenceHandoff: handoff }],
      }],
    },
    { fileExists: () => true, fileSize: () => 0 },
  );
  assert.equal(result.approved, false);
  assert.ok(result.reasons.some((r) => /empty/i.test(r)));
});

test('double-check owner prompt demands final re-verify', () => {
  const { systemPrompt, userPrompt } = buildDoubleCheckOwnerPrompt(
    { title: 'Header', description: 'Add menu' },
    [{ title: 'Style', acceptance_criteria: ['dark background'] }],
    'diff -- styles.css',
  );
  assert.match(systemPrompt, /FINAL double-check/i);
  assert.match(systemPrompt, /REJECTED automatically/i);
  assert.match(userPrompt, /Double-check rule/);
  assert.ok(userPrompt.includes('\n'), 'prompt must use real newlines');
});
