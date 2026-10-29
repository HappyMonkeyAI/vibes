import { existsSync, statSync } from 'fs';
import { isAbsolute, join } from 'path';
import type { Mission, Task } from './types.js';

export interface DoubleCheckResult {
  approved: boolean;
  reasons: string[];
}

export interface DoubleCheckDeps {
  fileExists?: (absolutePath: string) => boolean;
  fileSize?: (absolutePath: string) => number;
}

type TaskSlice = Pick<Task, 'title' | 'status' | 'files' | 'evidenceHandoff'>;

/**
 * Cline-style double-check: after leaf tasks claim done, reject a hasty
 * "mission complete" unless durable evidence still holds — declared files
 * exist on disk, and at least one handoff recorded real changes.
 *
 * Pure enough to unit-test; inject fs predicates when needed.
 */
export function doubleCheckMissionEvidence(
  mission: {
    title?: string;
    description?: string;
    workspace_root?: string;
    milestones: Array<{ tasks: TaskSlice[] }>;
  },
  deps: DoubleCheckDeps = {},
): DoubleCheckResult {
  const reasons: string[] = [];
  const exists = deps.fileExists ?? ((p) => existsSync(p));
  const sizeOf = deps.fileSize ?? ((p) => {
    try {
      return statSync(p).size;
    } catch {
      return -1;
    }
  });

  const title = (mission.title ?? '').trim();
  const description = (mission.description ?? '').trim();
  if (!title && !description) {
    reasons.push('Double-check: mission has no title or original request');
  }

  const tasks = mission.milestones.flatMap((m) => m.tasks);
  const done = tasks.filter((t) => t.status === 'done');
  if (done.length === 0) {
    reasons.push('Double-check: no done tasks to verify');
    return { approved: false, reasons };
  }

  const root = (mission.workspace_root ?? '').trim();
  const missingFiles: string[] = [];
  const emptyFiles: string[] = [];
  let declaredFileCount = 0;

  for (const task of done) {
    for (const file of task.files ?? []) {
      const rel = file.trim();
      if (!rel) continue;
      declaredFileCount += 1;
      if (!root) continue; // cannot resolve without workspace
      const absolute = isAbsolute(rel) ? rel : join(root, rel);
      if (!exists(absolute)) {
        missingFiles.push(`${task.title}: ${rel}`);
        continue;
      }
      const size = sizeOf(absolute);
      if (size === 0) emptyFiles.push(`${task.title}: ${rel}`);
    }
  }

  if (missingFiles.length > 0) {
    reasons.push(`Double-check: required files missing — ${missingFiles.join('; ')}`);
  }
  if (emptyFiles.length > 0) {
    reasons.push(`Double-check: required files empty — ${emptyFiles.join('; ')}`);
  }

  const changedPaths = done.flatMap((t) => t.evidenceHandoff?.changedPaths ?? []);
  const uniqueChanged = [...new Set(changedPaths.map((p) => p.trim()).filter(Boolean))];
  if (done.length > 1 && uniqueChanged.length === 0 && declaredFileCount === 0) {
    reasons.push('Double-check: multi-task mission left no changed paths and declared no files');
  }

  return { approved: reasons.length === 0, reasons };
}

/** Stricter Owner prompt: treat the first approval as rejected; re-verify. */
export function buildDoubleCheckOwnerPrompt(
  mission: Pick<Mission, 'title' | 'description'>,
  tasks: Array<Pick<Task, 'title' | 'acceptance_criteria'>>,
  diffContent: string,
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: `You are an independent Owner-as-Adversary performing a FINAL double-check. A prior completion claim was REJECTED automatically — do not rubber-stamp. Re-verify every acceptance criterion and the original user request against the mission diff only. Look for missing entrypoint wiring, dead code, omitted capabilities, and integration gaps. Output ONLY a JSON object with approved:boolean and issues:[{file,line,comment,severity,suggestion}].`,
    userPrompt: [
      `Mission: ${mission.title}`,
      'Original request:',
      mission.description,
      '',
      'Acceptance criteria to re-verify:',
      ...tasks.map((task) => `- ${task.title}: ${task.acceptance_criteria.join('; ')}`),
      '',
      'Mission diff:',
      '```diff',
      diffContent,
      '```',
      '',
      'Double-check rule: approve only if every criterion is met in the diff. If unsure, set approved:false.',
    ].join('\n'),
  };
}
