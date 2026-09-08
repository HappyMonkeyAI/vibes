export type ApprovalMode = 'default' | 'plan' | 'auto-edit' | 'yolo';
export type ApprovalDecision = 'allow' | 'ask' | 'deny';

export interface ToolInvocation {
  tool: string;
  args: Record<string, unknown>;
}

export interface ApprovalPolicyOptions {
  mode?: ApprovalMode;
  denyPatterns?: string[];
}

export interface ApprovalResult {
  decision: ApprovalDecision;
  reason: string;
}

/** What the TUI shows the user when a decision needs confirming. */
export interface ApprovalRequest {
  tool: string;
  reason: string;
  preview: string;
}

/** Resolves to `true` when the user approves the invocation. */
export type ApprovalRequester = (request: ApprovalRequest) => Promise<boolean>;

const READ_ONLY_TOOLS = new Set(['list_dir', 'file_read', 'read_lines', 'glob', 'file_outline', 'search_symbols']);
const EDIT_TOOLS = new Set(['write_file', 'edit_file', 'apply_patch']);

const patternCache = new Map<string, RegExp>();

function compileDenyPattern(pattern: string): RegExp {
  const cached = patternCache.get(pattern);
  if (cached) return cached;
  const compiled = new RegExp(pattern, 'i');
  patternCache.set(pattern, compiled);
  return compiled;
}

/** Split the comma-separated config form into individual rules. */
export function parseDenyPatterns(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : raw.split(',');
  return parts.map(part => part.trim()).filter(Boolean);
}

/** Call at config load so a malformed rule surfaces as a config error, not a per-tool-call surprise. */
export function validateDenyPatterns(patterns: string[] = []): void {
  for (const pattern of patterns) {
    try {
      compileDenyPattern(pattern);
    } catch (error) {
      throw new Error(`Invalid approval deny pattern ${JSON.stringify(pattern)}: ${(error as Error).message}`);
    }
  }
}

/**
 * Deny rules match the raw tool name and raw string arguments, never the JSON
 * serialisation. Matching `JSON.stringify(args)` is escape-blind: a command
 * containing a newline serialises as the two characters `\` and `n`, so a rule
 * like `rm\s+-rf` silently fails to match `rm\n-rf /`.
 */
function denyHaystacks(invocation: ToolInvocation): string[] {
  const values: string[] = [invocation.tool];
  const visit = (value: unknown, depth: number): void => {
    if (depth > 4) return;
    if (typeof value === 'string') values.push(value);
    else if (Array.isArray(value)) for (const item of value) visit(item, depth + 1);
    else if (value && typeof value === 'object') for (const item of Object.values(value)) visit(item, depth + 1);
  };
  visit(invocation.args, 0);
  return values;
}

export function decideApproval(invocation: ToolInvocation, options: ApprovalPolicyOptions = {}): ApprovalResult {
  const mode = options.mode ?? 'default';
  const haystacks = denyHaystacks(invocation);

  for (const pattern of options.denyPatterns ?? []) {
    let regex: RegExp;
    try {
      regex = compileDenyPattern(pattern);
    } catch {
      // An unusable rule must not silently widen what is permitted.
      return { decision: 'deny', reason: `Unusable deny rule ${pattern}; failing closed` };
    }
    if (haystacks.some(value => regex.test(value))) {
      return { decision: 'deny', reason: `Matched explicit deny rule: ${pattern}` };
    }
  }

  if (READ_ONLY_TOOLS.has(invocation.tool)) {
    return { decision: 'allow', reason: 'Read-only tool' };
  }
  if (mode === 'plan' && (EDIT_TOOLS.has(invocation.tool) || invocation.tool === 'shell')) {
    return { decision: 'deny', reason: 'Plan mode forbids mutations and shell execution' };
  }
  // YOLO is the permissive mode, matching `config.YOLO_MODE`: deny rules are the
  // only guard. Excluding shell here would make YOLO stricter than default mode
  // for the one tool it exists to unblock.
  if (mode === 'yolo') {
    return { decision: 'allow', reason: 'YOLO mode permits every tool no deny rule matched' };
  }
  if (mode === 'auto-edit' && EDIT_TOOLS.has(invocation.tool)) {
    return { decision: 'allow', reason: 'Auto-edit mode permits file edits' };
  }
  return { decision: 'ask', reason: `Approval required for ${invocation.tool}` };
}

export function previewInvocation(invocation: ToolInvocation): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(invocation.args ?? {}) ?? '{}';
  } catch {
    serialized = '<unserializable arguments>';
  }
  return serialized.length > 400 ? `${serialized.slice(0, 400)}…` : serialized;
}

/**
 * `ask` is a third state, not a synonym for `deny`. Without a `requestApproval`
 * channel every mutation would be blocked outright with no way to proceed, so the
 * absence of one is reported as the configuration error it is.
 */
export function createApprovalHook(options: ApprovalPolicyOptions, requestApproval?: ApprovalRequester) {
  return async ({ toolCall, args }: { toolCall: Record<string, unknown>; args: unknown }) => {
    const functionCall = (toolCall as any).function ?? {};
    const invocation: ToolInvocation = {
      tool: String(functionCall.name ?? ''),
      args: (args && typeof args === 'object' ? args : {}) as Record<string, unknown>,
    };
    const result = decideApproval(invocation, options);

    if (result.decision === 'allow') return undefined;
    if (result.decision === 'deny') return { block: true, reason: result.reason };

    if (!requestApproval) {
      return {
        block: true,
        reason: `${result.reason} — no approval channel is wired for APPROVAL_MODE=${options.mode ?? 'default'}`,
      };
    }

    const approved = await requestApproval({
      tool: invocation.tool,
      reason: result.reason,
      preview: previewInvocation(invocation),
    });
    return approved ? undefined : { block: true, reason: `Denied by user: ${invocation.tool}` };
  };
}
