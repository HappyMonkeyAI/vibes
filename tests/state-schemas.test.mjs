import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseMemory,
  serializeMemory,
  parseCheckpoint,
  serializeCheckpoint,
  parseNotes,
  serializeNotes,
  parseProgress,
  serializeProgress,
} from '../dist/agent/state-schemas.js';

test('Memory MD parser and serializer work correctly', () => {
  const markdownInput = `---
type: project-memory
tags:
  - typescript
  - node
created: 2026-06-16
blast_radius: low
confidence: 0.95
---

# Workspace Rules
- Rule number one
- Rule number two

# Stack Assumptions
- Node version >= 22
- ESM modules only

# Workspace Constraints
- Do not use Tailwind CSS unless requested

# Absolute Directories
- /home/stephen/projects/ai-agent-teamwork
`;

  const parsed = parseMemory(markdownInput);

  assert.equal(parsed.metadata.type, 'project-memory');
  assert.deepEqual(parsed.metadata.tags, ['typescript', 'node']);
  assert.equal(parsed.metadata.created, '2026-06-16');
  assert.equal(parsed.metadata.blast_radius, 'low');
  assert.equal(parsed.metadata.confidence, 0.95);

  assert.deepEqual(parsed.workspace_rules, ['Rule number one', 'Rule number two']);
  assert.deepEqual(parsed.stack_assumptions, ['Node version >= 22', 'ESM modules only']);
  assert.deepEqual(parsed.workspace_constraints, ['Do not use Tailwind CSS unless requested']);
  assert.deepEqual(parsed.absolute_directories, ['/home/stephen/projects/ai-agent-teamwork']);

  const serialized = serializeMemory(parsed);
  assert.match(serialized, /type: project-memory/);
  assert.match(serialized, /blast_radius: low/);
  assert.match(serialized, /# Workspace Rules\n- Rule number one/);

  // Parse again and ensure identity
  const roundtrip = parseMemory(serialized);
  assert.deepEqual(roundtrip, parsed);
});

test('Checkpoint MD parser and serializer work correctly', () => {
  const checkpointData = {
    timestamp: '2026-06-16T13:40:00Z',
    git_sha: 'a1b2c3d4e5f6',
    env_vars: {
      NODE_ENV: 'development',
      PORT: '3000',
    },
    dirty_files: [
      { path: 'src/index.tsx', size: 1234, status: 'modified', hash: 'abcd' },
      { path: 'tests/config.test.mjs', size: 567, status: 'added' },
    ],
    last_test_run: {
      status: 'passed',
      timestamp: '2026-06-16T13:39:50Z',
      summary: 'All 4 tests passed',
    },
  };

  const serialized = serializeCheckpoint(checkpointData);
  assert.match(serialized, /- \*\*Timestamp\*\*: 2026-06-16T13:40:00Z/);
  assert.match(serialized, /- \*\*Git SHA\*\*: a1b2c3d4e5f6/);
  assert.match(serialized, /- `NODE_ENV`: development/);
  assert.match(serialized, /\| src\/index.tsx \| 1234 \| modified \| abcd \|/);

  const parsed = parseCheckpoint(serialized);
  assert.equal(parsed.timestamp, checkpointData.timestamp);
  assert.equal(parsed.git_sha, checkpointData.git_sha);
  assert.deepEqual(parsed.env_vars, checkpointData.env_vars);
  assert.equal(parsed.dirty_files.length, 2);
  assert.equal(parsed.dirty_files[0].path, 'src/index.tsx');
  assert.equal(parsed.dirty_files[0].status, 'modified');
  assert.equal(parsed.dirty_files[0].size, 1234);
  assert.equal(parsed.dirty_files[0].hash, 'abcd');
  assert.equal(parsed.dirty_files[1].path, 'tests/config.test.mjs');
  assert.equal(parsed.dirty_files[1].status, 'added');
  assert.equal(parsed.dirty_files[1].hash, undefined);
  assert.deepEqual(parsed.last_test_run, checkpointData.last_test_run);
});

test('Notes MD parser and serializer work correctly', () => {
  const notesData = {
    entries: [
      {
        timestamp: '2026-06-16T13:40:00Z',
        category: 'Discovery',
        content: 'Discovered that ESM is required for all workspace files.',
      },
      {
        timestamp: '2026-06-16T13:42:00Z',
        content: 'No category note test.',
      },
    ],
  };

  const serialized = serializeNotes(notesData);
  assert.match(serialized, /## \[2026-06-16T13:40:00Z\] Discovery/);
  assert.match(serialized, /## \[2026-06-16T13:42:00Z\]/);

  const parsed = parseNotes(serialized);
  assert.deepEqual(parsed.entries, notesData.entries);
});

test('Progress MD parser and serializer work correctly', () => {
  const progressData = {
    goals: [
      {
        id: 'goal-1',
        title: 'Project Setup',
        status: 'done',
      },
      {
        id: 'goal-2',
        title: 'Core Implementation',
        status: 'in_progress',
        children: [
          {
            id: 'sub-2.1',
            title: 'Define state schemas',
            status: 'in_progress',
          },
          {
            id: 'sub-2.2',
            title: 'Write tests',
            status: 'todo',
          },
        ],
      },
      {
        id: 'goal-3',
        title: 'Validation',
        status: 'blocked',
      },
    ],
  };

  const serialized = serializeProgress(progressData);
  assert.match(serialized, /- \[x\] goal-1: Project Setup/);
  assert.match(serialized, /  - \[\/\] sub-2.1: Define state schemas/);
  assert.match(serialized, /  - \[ \] sub-2.2: Write tests/);
  assert.match(serialized, /- \[!\] goal-3: Validation/);

  const parsed = parseProgress(serialized);
  assert.deepEqual(parsed.goals, progressData.goals);
});
