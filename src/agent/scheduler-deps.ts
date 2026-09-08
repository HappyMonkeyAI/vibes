import { Task } from './types.js';

/**
 * Review and build verification inspect the same mutable workspace as the
 * executor. Do not overlap reviewed code tasks: a verifier can otherwise run
 * while a sibling task is halfway through a write or dependency update.
 */
export function getExecutionConcurrency(
  tasks: Task[],
  requestedConcurrency: number,
  reviewerEnabled: boolean,
): number {
  if (reviewerEnabled && tasks.some(task => task.status === 'todo' && task.type === 'code')) {
    return 1;
  }
  return Math.max(1, requestedConcurrency);
}

export function describeDependencyDeadlock(tasks: Task[], completedTaskIds: Set<string>): string | null {
  const pending = tasks.filter((task) => task.status === 'todo' || task.status === 'in_progress');
  if (pending.length === 0) {
    return null;
  }

  const ready = pending.filter(
    (task) =>
      task.status === 'todo' &&
      task.depends_on.every((depId) => completedTaskIds.has(depId)),
  );
  if (ready.length > 0) {
    return null;
  }

  const pendingIds = new Set(pending.map((task) => task.id));
  const blocked = pending
    .map((task) => {
      const unmet = task.depends_on.filter((depId) => !completedTaskIds.has(depId));
      const waitingOnPending = unmet.filter((depId) => pendingIds.has(depId));
      return { task, unmet, waitingOnPending };
    })
    .filter((entry) => entry.unmet.length > 0);

  const blockedTitles = blocked.map((entry) => entry.task.title).join(', ');
  const cycleHint = blocked.some((entry) => entry.waitingOnPending.length > 0)
    ? ' This usually means the mission plan has circular depends_on links (e.g. "Create Card" waits on "Add Styling" while "Add Styling" waits on "Create Card").'
    : '';

  const details = blocked
    .map((entry) => {
      const waitingTitles = entry.waitingOnPending
        .map((depId) => tasks.find((task) => task.id === depId)?.title ?? depId)
        .join(', ');
      return `${entry.task.title} -> waiting on: ${waitingTitles || entry.unmet.join(', ')}`;
    })
    .join('; ');

  return `Scheduler deadlock: no runnable tasks remain, but ${pending.length} task(s) are still pending (${blockedTitles}).${cycleHint} ${details}`;
}