import { z } from 'zod';

export const CompletionClaimTypeSchema = z.enum([
  'created', 'modified', 'deleted', 'renamed', 'tests_pass', 'build_pass', 'deferred', 'no_change',
]);
export type CompletionClaimType = z.infer<typeof CompletionClaimTypeSchema>;

export const CompletionClaimSchema = z.object({
  type: CompletionClaimTypeSchema,
  file: z.string().optional(),
  command: z.string().optional(),
  exitCode: z.number().optional(),
  what: z.string().optional(),
  why: z.string().optional(),
});
export type CompletionClaim = z.infer<typeof CompletionClaimSchema>;

export const CompletionReceiptSchema = z.object({
  v: z.literal(1),
  task: z.string(),
  status: z.enum(['complete', 'partial', 'blocked']),
  claims: z.array(CompletionClaimSchema),
});
export type CompletionReceipt = z.infer<typeof CompletionReceiptSchema>;

export interface VerificationCommand {
  command: string;
  exitCode: number;
}

export interface CompletionReality {
  changedFiles: string[];
  verificationCommands: VerificationCommand[];
}

export interface CompletionReceiptResult {
  valid: boolean;
  errors: string[];
}

const FILE_CLAIM_TYPES = new Set<CompletionClaimType>(['created', 'modified', 'deleted', 'renamed']);

/**
 * Receipts come from a model, so the shape is checked before it is trusted —
 * a malformed receipt must return `valid: false`, never throw.
 */
export function validateCompletionReceipt(
  receipt: unknown,
  reality: CompletionReality,
): CompletionReceiptResult {
  const parsed = CompletionReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(issue => `Malformed completion receipt at ${issue.path.join('.') || '<root>'}: ${issue.message}`),
    };
  }

  const value = parsed.data;
  const errors: string[] = [];
  const changed = new Set(reality.changedFiles);
  const verified = new Map(reality.verificationCommands.map(item => [item.command, item.exitCode]));

  if (!value.task.trim()) errors.push('Completion receipt task is empty');
  if (value.claims.length === 0) errors.push('Completion receipt has no claims');

  for (const claim of value.claims) {
    if (FILE_CLAIM_TYPES.has(claim.type)) {
      if (!claim.file) {
        errors.push(`${claim.type} claim has no file`);
      } else if (!changed.has(claim.file)) {
        errors.push(`${claim.type} claim is absent from the Git diff: ${claim.file}`);
      }
    }

    if (claim.type === 'tests_pass' || claim.type === 'build_pass') {
      if (!claim.command) {
        errors.push(`${claim.type} claim has no command`);
      } else if (!verified.has(claim.command)) {
        errors.push(`No captured verification evidence for: ${claim.command}`);
      } else {
        if (verified.get(claim.command) !== 0) {
          errors.push(`Verification did not pass: ${claim.command}`);
        }
        if (claim.exitCode !== 0) {
          errors.push(`Claimed verification has non-zero exit code: ${claim.command}`);
        }
      }
    }

    if (claim.type === 'deferred' && (!claim.what || !claim.why)) {
      errors.push('Deferred claim must include what and why');
    }
  }

  if (value.status === 'complete' && value.claims.some(claim => claim.type === 'deferred')) {
    errors.push('Complete receipt cannot contain deferred claims');
  }

  return { valid: errors.length === 0, errors };
}
