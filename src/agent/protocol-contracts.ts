import { z } from 'zod';

export const ContextPackSchema = z.object({
  taskId: z.string().min(1),
  repo: z.string().min(1),
  worktree: z.string().min(1),
  baseRef: z.string().min(1).optional(),
  goal: z.string().min(1),
  dependsOn: z.array(z.string()),
  ownedFiles: z.array(z.string()),
  outOfScope: z.array(z.string()),
  verifyCommands: z.array(z.string()),
  constraints: z.array(z.string()),
});
export type ContextPack = z.infer<typeof ContextPackSchema>;

const CommandResultSchema = z.object({
  command: z.string().min(1),
  exitCode: z.number().int(),
  summary: z.string().min(1),
});

export const EvidenceHandoffSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['done', 'blocked', 'in_progress']),
  worktree: z.string().min(1),
  branch: z.string().min(1),
  baseline: z.string().min(1),
  changedPaths: z.array(z.string()),
  commandsAndResults: z.array(CommandResultSchema),
  knownFailuresOrSkips: z.array(z.string()),
  commit: z.string().nullable(),
  push: z.boolean(),
  verificationLayers: z.array(z.enum(['unit', 'integration', 'e2e', 'live'])),
});
export type EvidenceHandoff = z.infer<typeof EvidenceHandoffSchema>;

export const OwnerAdversaryReviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.object({
    file: z.string().min(1),
    line: z.number().int().nonnegative(),
    comment: z.string().min(1),
    severity: z.enum(['error', 'warning']),
    suggestion: z.string().optional(),
  })),
  feedback: z.string().optional(),
});
export type OwnerAdversaryReview = z.infer<typeof OwnerAdversaryReviewSchema>;

export function createContextPack(
  mission: { id: string; workspace_root: string },
  task: { id: string; title: string; description: string; files?: string[]; depends_on?: string[] },
  options: {
    worktree?: string;
    baseRef?: string;
    verifyCommands?: string[];
    constraints?: string[];
    outOfScope?: string[];
  } = {},
): ContextPack {
  return ContextPackSchema.parse({
    taskId: task.id,
    repo: mission.workspace_root,
    worktree: options.worktree ?? mission.workspace_root,
    ...(options.baseRef ? { baseRef: options.baseRef } : {}),
    goal: `${task.title}: ${task.description}`,
    dependsOn: task.depends_on ?? [],
    ownedFiles: task.files ?? [],
    outOfScope: options.outOfScope ?? [],
    verifyCommands: options.verifyCommands ?? [],
    constraints: options.constraints ?? ['no push', 'no drive-by refactor'],
  });
}

export function createEvidenceHandoff(
  task: { id: string; status?: string; files?: string[] },
  evidence: {
    worktree: string;
    branch: string;
    baseline: string;
    commandsAndResults: Array<{ command: string; exitCode: number; summary: string }>;
    knownFailuresOrSkips?: string[];
    commit?: string | null;
    push?: boolean;
    verificationLayers?: Array<'unit' | 'integration' | 'e2e' | 'live'>;
    status?: 'done' | 'blocked' | 'in_progress';
  },
): EvidenceHandoff {
  const status = evidence.status ?? (task.status === 'done' ? 'done' : 'in_progress');
  return EvidenceHandoffSchema.parse({
    taskId: task.id,
    status,
    worktree: evidence.worktree,
    branch: evidence.branch,
    baseline: evidence.baseline,
    changedPaths: task.files ?? [],
    commandsAndResults: evidence.commandsAndResults,
    knownFailuresOrSkips: evidence.knownFailuresOrSkips ?? [],
    commit: evidence.commit ?? null,
    push: evidence.push ?? false,
    verificationLayers: evidence.verificationLayers ?? [],
  });
}
