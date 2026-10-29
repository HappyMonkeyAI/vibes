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

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const pendingIds = new Set(pending.map((task) => task.id));
  const blocked = pending
    .map((task) => {
      const unmet = task.depends_on.filter((depId) => !completedTaskIds.has(depId));
      const waitingOnPending = unmet.filter((depId) => pendingIds.has(depId));
      const waitingOnGhost = unmet.filter((depId) => {
        const dep = byId.get(depId);
        return Boolean(dep && (dep.status === 'done' || dep.status === 'failed') && !completedTaskIds.has(depId));
      });
      const waitingOnMissing = unmet.filter((depId) => !byId.has(depId));
      return { task, unmet, waitingOnPending, waitingOnGhost, waitingOnMissing };
    })
    .filter((entry) => entry.unmet.length > 0);

  const stuckInProgress = pending.filter(
    (task) => task.status === 'in_progress' && task.depends_on.every((depId) => completedTaskIds.has(depId)),
  );

  const blockedTitles = [
    ...blocked.map((entry) => entry.task.title),
    ...stuckInProgress.map((task) => task.title),
  ].join(', ');
  const hasCycle = blocked.some((entry) => entry.waitingOnPending.length > 0);
  const hasGhost = blocked.some((entry) => entry.waitingOnGhost.length > 0);
  const hasMissing = blocked.some((entry) => entry.waitingOnMissing.length > 0);
  let cycleHint = '';
  if (stuckInProgress.length > 0) {
    cycleHint =
      ' A task is stuck in_progress with no runner (soft-requeue raced a second start and the first finally cleared the slot).';
  } else if (hasGhost) {
    cycleHint =
      ' A prerequisite is marked done/failed but was never credited as complete (post-success gate bug), so dependents stay blocked.';
  } else if (hasMissing) {
    cycleHint = ' A depends_on entry points at a task id that is not in the plan.';
  } else if (hasCycle) {
    cycleHint =
      ' This usually means the mission plan has circular depends_on links (e.g. "Create Card" waits on "Add Styling" while "Add Styling" waits on "Create Card").';
  }

  const describeDep = (depId: string): string => {
    const dep = byId.get(depId);
    if (!dep) return `${depId} (missing from plan)`;
    if (dep.status === 'done' && !completedTaskIds.has(depId)) {
      return `${dep.title} (done but not credited complete)`;
    }
    if (dep.status === 'failed' && !completedTaskIds.has(depId)) {
      return `${dep.title} (failed)`;
    }
    return dep.title;
  };

  const details = [
    ...blocked.map((entry) => {
      const waitingTitles = entry.unmet.map(describeDep).join(', ');
      return `${entry.task.title} -> waiting on: ${waitingTitles}`;
    }),
    ...stuckInProgress.map((task) => `${task.title} -> stuck in_progress with deps satisfied`),
  ].join('; ');

  return `Scheduler deadlock: no runnable tasks remain, but ${pending.length} task(s) are still pending (${blockedTitles}).${cycleHint} ${details}`;
}
