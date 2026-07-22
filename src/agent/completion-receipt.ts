export type CompletionClaimType = 'created' | 'modified' | 'deleted' | 'renamed' | 'tests_pass' | 'build_pass' | 'deferred' | 'no_change';

export interface CompletionClaim {
  type: CompletionClaimType;
  file?: string;
  command?: string;
  exitCode?: number;
  what?: string;
  why?: string;
}

export interface CompletionReceipt {
  v: 1;
  task: string;
  status: 'complete' | 'partial' | 'blocked';
  claims: CompletionClaim[];
}

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

export function validateCompletionReceipt(
  receipt: CompletionReceipt,
  reality: CompletionReality,
): CompletionReceiptResult {
  const errors: string[] = [];
  const changed = new Set(reality.changedFiles);
  const verified = new Map(reality.verificationCommands.map(item => [item.command, item.exitCode]));

  if (receipt.v !== 1) errors.push('Unsupported completion receipt version');
  if (!receipt.task.trim()) errors.push('Completion receipt task is empty');
  if (receipt.claims.length === 0) errors.push('Completion receipt has no claims');

  for (const claim of receipt.claims) {
    if (['created', 'modified', 'deleted', 'renamed'].includes(claim.type)) {
      if (!claim.file) {
        errors.push(`${claim.type} claim has no file`);
      } else if (!changed.has(claim.file)) {
        errors.push(`${claim.type} claim is absent from the Git diff: ${claim.file}`);
      }
    }

    if (claim.type === 'tests_pass' || claim.type === 'build_pass') {
      if (!claim.command) {
        errors.push(`${claim.type} claim has no command`);
      } else {
        const actualExitCode = verified.get(claim.command);
        if (actualExitCode !== 0) {
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

  if (receipt.status === 'complete' && receipt.claims.some(claim => claim.type === 'deferred')) {
    errors.push('Complete receipt cannot contain deferred claims');
  }

  return { valid: errors.length === 0, errors };
}
