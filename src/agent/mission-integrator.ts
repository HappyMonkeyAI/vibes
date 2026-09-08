import { v4 as uuidv4 } from 'uuid';
import type { Mission, Task } from './types.js';
import { EvidenceHandoffSchema, OwnerAdversaryReviewSchema } from './protocol-contracts.js';

const INTEGRATION_TITLE = 'Final integration and verification';

export function isIntegrationTask(task: Pick<Task, 'title' | 'description'>): boolean {
  return /\b(?:final\s+)?integration\b|whole[- ]feature|end[- ]to[- ]end\s+verification/i.test(
    `${task.title} ${task.description}`,
  );
}

export interface MissionCompletionResult {
  approved: boolean;
  reasons: string[];
}

export function evaluateMissionCompletion(mission: {
  ownerReview?: unknown;
  milestones: Array<{ tasks: Array<Pick<Task, 'id' | 'title' | 'description' | 'status' | 'evidenceHandoff'>> }>;
}): MissionCompletionResult {
  const tasks = mission.milestones.flatMap(milestone => milestone.tasks);
  if (tasks.length === 0) return { approved: false, reasons: ['Mission contains no tasks'] };

  const reasons: string[] = [];
  const incomplete = tasks.filter(task => task.status !== 'done');
  if (incomplete.length > 0) {
    reasons.push(`Incomplete tasks remain: ${incomplete.map(task => task.title).join(', ')}`);
  }

  if (tasks.length > 1 && !tasks.some(isIntegrationTask)) {
    reasons.push('Multi-task mission has no final integration task');
  } else if (tasks.length > 1) {
    const integration = tasks.find(isIntegrationTask);
    if (integration?.status !== 'done') reasons.push('Final integration task is not done');
    else {
      const handoff = EvidenceHandoffSchema.safeParse(integration.evidenceHandoff);
      if (!handoff.success || handoff.data.status !== 'done') {
        reasons.push('Final integration task has no valid evidence handoff');
      } else if (
        handoff.data.changedPaths.length === 0
        || handoff.data.commandsAndResults.length === 0
        || handoff.data.commandsAndResults.some(result => result.exitCode !== 0)
        || handoff.data.verificationLayers.length === 0
      ) {
        reasons.push('Final integration handoff lacks passing verification evidence');
      }
    }
  }

  if (mission.ownerReview !== undefined) {
    const review = OwnerAdversaryReviewSchema.safeParse(mission.ownerReview);
    if (!review.success) reasons.push('Owner adversary review is malformed');
    else if (!review.data.approved) reasons.push('Owner adversary review rejected the mission');
  }

  return { approved: reasons.length === 0, reasons };
}

/**
 * Reserve a parent-owned task for cross-file wiring and whole-request proof.
 * Leaf tasks remain focused; this task is the only one that owns final
 * entrypoint integration and end-to-end verification.
 */
export function ensureIntegrationTask(mission: Mission): Mission {
  const allTasks = mission.milestones.flatMap(milestone => milestone.tasks);
  if (allTasks.length < 2 || allTasks.some(isIntegrationTask)) return mission;

  const finalMilestone = mission.milestones.at(-1);
  if (!finalMilestone) return mission;

  const files = [...new Set(allTasks.flatMap(task => task.files))];
  const integrationTask: Task = {
    id: uuidv4(),
    title: INTEGRATION_TITLE,
    description: 'Wire the completed work into the real entrypoint and verify the whole user request.',
    files,
    acceptance_criteria: [
      'All requested capabilities are wired into the real entrypoint',
      'Cross-file integration behaves as requested',
      'The project build and applicable tests pass',
    ],
    depends_on: allTasks.map(task => task.id),
    use_reviewer_model: true,
    type: 'code',
    status: 'todo',
  };

  finalMilestone.tasks.push(integrationTask);
  return mission;
}
