import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureIntegrationTask } from '../dist/agent/mission-integrator.js';

test('adds a final integration task for a multi-task mission', () => {
  const mission = {
    id: 'mission-1',
    title: 'Loading skeleton',
    description: 'Build a skeleton and integrate it',
    workspace_root: '/repo',
    status: 'planning',
    milestones: [{
      id: 'milestone-1',
      title: 'Build',
      description: 'Build components',
      tasks: [
        {
          id: 'task-1',
          title: 'Create base',
          description: 'Create base component',
          files: ['src/Skeleton.tsx'],
          acceptance_criteria: ['base exists'],
          depends_on: [],
          type: 'code',
          status: 'todo',
        },
        {
          id: 'task-2',
          title: 'Create variant',
          description: 'Create variant component',
          files: ['src/SkeletonCircle.tsx'],
          acceptance_criteria: ['variant exists'],
          depends_on: ['task-1'],
          type: 'code',
          status: 'todo',
        },
      ],
    }],
  };

  const result = ensureIntegrationTask(mission);
  const integration = result.milestones[0].tasks.at(-1);

  assert.equal(result.milestones[0].tasks.length, 3);
  assert.equal(integration.title, 'Final integration and verification');
  assert.deepEqual(integration.depends_on, ['task-1', 'task-2']);
  assert.deepEqual(integration.files, ['src/Skeleton.tsx', 'src/SkeletonCircle.tsx']);
  assert.ok(integration.acceptance_criteria.some(item => item.includes('real entrypoint')));
});

test('does not duplicate an existing integration task', () => {
  const mission = {
    id: 'mission-1',
    title: 'Small mission',
    description: 'Already integrated',
    workspace_root: '/repo',
    status: 'planning',
    milestones: [{
      id: 'milestone-1',
      title: 'Build',
      description: 'Build',
      tasks: [{
        id: 'task-1',
        title: 'Final integration and verification',
        description: 'Verify integration',
        files: ['package.json'],
        acceptance_criteria: ['build passes'],
        depends_on: [],
        type: 'code',
        status: 'todo',
      }],
    }],
  };

  assert.equal(ensureIntegrationTask(mission).milestones[0].tasks.length, 1);
});
