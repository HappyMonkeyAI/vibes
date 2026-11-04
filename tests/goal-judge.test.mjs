import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { GoalJudge, createDefaultGoalJudge } from '../dist/agent/goal-judge.js';

function makeTask(overrides = {}) {
  return {
    id: 'test-001',
    title: 'Test task',
    description: 'A test task',
    status: 'done',
    files: [],
    acceptance_criteria: ['File exists', 'Output is non-empty'],
    output: 'Task completed successfully',
    error: undefined,
    depends_on: [],
    type: 'code',
    ...overrides,
  };
}

test('approves a well-formed completed task', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'goal-judge-test-'));
  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));

  const judge = new GoalJudge();
  const task = makeTask({
    files: ['package.json'],
    acceptance_criteria: ['Package file exists'],
  });
  const result = await judge.evaluate(task, tmpDir);

  assert.equal(result.approved, true);
  assert.deepEqual(result.unmetCriteria, []);
  assert.equal(result.feedback, undefined);
});

test('rejects when declared files are missing', async () => {
  const judge = new GoalJudge();
  const task = makeTask({
    files: ['src/nonexistent.ts'],
  });

  const result = await judge.evaluate(task);

  assert.equal(result.approved, false);
  assert.ok(result.unmetCriteria.some(c => c.includes('nonexistent.ts')));
  assert.ok(result.feedback);
});

test('rejects when declared file exists but is empty', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'goal-judge-test-'));
  const emptyFile = 'empty.txt';
  writeFileSync(join(tmpDir, emptyFile), '');

  const judge = new GoalJudge();
  const task = makeTask({
    files: [emptyFile],
  });

  const result = await judge.evaluate(task, tmpDir);

  assert.equal(result.approved, false);
  assert.ok(result.unmetCriteria.some(c => c.includes('empty')));
});

test('approves when declared files exist and have content', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'goal-judge-test-'));
  const realFile = 'real.txt';
  writeFileSync(join(tmpDir, realFile), 'hello world');

  const judge = new GoalJudge();
  const task = makeTask({
    files: [realFile],
  });

  const result = await judge.evaluate(task, tmpDir);

  assert.equal(result.approved, true);
  assert.deepEqual(result.unmetCriteria, []);
});

test('approves fence-only leaf with no files when done + criteria + output (T88)', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'goal-judge-test-'));
  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'probe', scripts: {} }));

  const judge = new GoalJudge();
  const task = makeTask({
    files: [],
    type: 'research',
    acceptance_criteria: ['Stack fence blocked React write'],
    output: 'file_write src/App.tsx denied by Stack fence (vanilla-three)',
  });

  const result = await judge.evaluate(task, tmpDir);

  assert.equal(result.approved, true, result.feedback);
  assert.deepEqual(result.unmetCriteria, []);
});

test('skips existence for .tsx probe on vanilla-three workspace (T88)', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'goal-judge-fence-'));
  writeFileSync(
    join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'vrgallery', dependencies: { three: '^0.185.0' }, scripts: {} }),
  );
  mkdirSync(join(tmpDir, 'src'), { recursive: true });
  writeFileSync(join(tmpDir, 'src', 'main.ts'), 'export {};\n');

  const judge = new GoalJudge();
  const task = makeTask({
    files: ['src/App.tsx', 'src/main.ts'],
    type: 'research',
    acceptance_criteria: ['React probe blocked', 'vanilla entry intact'],
    output: 'Stack fence denied App.tsx; main.ts ok',
  });

  const result = await judge.evaluate(task, tmpDir);

  assert.equal(result.approved, true, result.feedback);
  assert.ok(!result.unmetCriteria.some((c) => c.includes('App.tsx')));
});

test('rejects when task completed without output', async () => {
  const judge = new GoalJudge();
  const task = makeTask({ output: '' });

  const result = await judge.evaluate(task);

  assert.equal(result.approved, false);
  assert.ok(result.unmetCriteria.some(c => c.includes('output')));
});

test('rejects when task has both done status and error', async () => {
  const judge = new GoalJudge();
  const task = makeTask({ error: 'Something went wrong' });

  const result = await judge.evaluate(task);

  assert.equal(result.approved, false);
  assert.ok(result.unmetCriteria.some(c => c.includes('error')));
});

test('rejects when task has no acceptance criteria', async () => {
  const judge = new GoalJudge();
  const task = makeTask({ acceptance_criteria: [] });

  const result = await judge.evaluate(task);

  assert.equal(result.approved, false);
  assert.ok(result.unmetCriteria.some(c => c.includes('acceptance criteria')));
});

test('rejects when task status is not done', async () => {
  const judge = new GoalJudge();
  const task = makeTask({ status: 'failed' });

  const result = await judge.evaluate(task);

  assert.equal(result.approved, false);
  assert.ok(result.unmetCriteria.some(c => c.includes('failed')));
});

test('createDefaultGoalJudge returns a GoalJudge instance', () => {
  const judge = createDefaultGoalJudge();
  assert.ok(judge instanceof GoalJudge);
});

test('approves when declared file is empty but task title or description contains "(empty)"', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'goal-judge-test-'));
  const emptyFile = 'empty.txt';
  writeFileSync(join(tmpDir, emptyFile), '');

  const judge = new GoalJudge();
  const task = makeTask({
    files: [emptyFile],
    title: 'Create empty file',
  });

  const result = await judge.evaluate(task, tmpDir);

  assert.equal(result.approved, true);
  assert.deepEqual(result.unmetCriteria, []);
});
