import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  StackTraceTransform, 
  RepeatLineTransform, 
  NoiseReductionTransform,
  applyTransforms 
} from '../dist/agent/compaction/transforms.js';

test('StackTraceTransform trims long stacks', () => {
  const input = [
    'Error: something went wrong',
    '    at Object.<anonymous> (file:///test.js:1:1)',
    ...Array(30).fill('    at internal (node:internal/test:1:1)'),
    '    at main (file:///main.js:10:1)'
  ].join('\n');

  const output = StackTraceTransform.apply(input);
  assert.ok(output.includes('trimmed'));
  assert.ok(output.includes('lines of stack trace'));
  assert.ok(output.includes('Error: something went wrong'));
  assert.ok(output.includes('at main (file:///main.js:10:1)'));
});

test('RepeatLineTransform collapses identical lines', () => {
  const input = [
    'Starting process...',
    ...Array(10).fill('Still working...'),
    'Finished!'
  ].join('\n');

  const output = RepeatLineTransform.apply(input);
  assert.ok(output.includes('[... repeated 9 more times ...]'));
  assert.ok(output.includes('Starting process...'));
  assert.ok(output.includes('Finished!'));
});

test('NoiseReductionTransform reduces npm noise', () => {
  const input = `
npm info it worked if it ends with ok
npm info using npm@10.2.4
added 124 packages, and audited 125 packages in 3s
  run \`npm fund\` for details
found 0 vulnerabilities
ok
`.trim();

  const output = NoiseReductionTransform.apply(input);
  assert.ok(output.includes('added 124 packages'));
  assert.ok(output.includes('found 0 vulnerabilities'));
  assert.ok(output.includes('removed'));
  assert.ok(!output.includes('npm info'));
  assert.ok(!output.includes('npm fund'));
});

test('applyTransforms runs the pipeline', () => {
  const input = [
    'Error: deploy failed',
    ...Array(25).fill('    at step (node:internal:1:1)'),
    ...Array(10).fill('Retrying...'),
    'npm info install',
    'Finished!'
  ].join('\n');

  const output = applyTransforms(input);
  assert.ok(output.includes('trimmed'));
  assert.ok(output.includes('repeated'));
  assert.ok(output.includes('removed'));
  assert.ok(output.includes('Finished!'));
});
