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

const READ_ONLY_TOOLS = new Set(['list_dir', 'file_read', 'read_lines', 'glob', 'file_outline', 'search_symbols']);
const EDIT_TOOLS = new Set(['write_file', 'edit_file', 'apply_patch']);

export function decideApproval(invocation: ToolInvocation, options: ApprovalPolicyOptions = {}): ApprovalResult {
  const mode = options.mode ?? 'default';
  const serialized = `${invocation.tool} ${JSON.stringify(invocation.args)}`;
  for (const pattern of options.denyPatterns ?? []) {
    if (new RegExp(pattern, 'i').test(serialized)) {
      return { decision: 'deny', reason: `Matched explicit deny rule: ${pattern}` };
    }
  }

  if (READ_ONLY_TOOLS.has(invocation.tool)) {
    return { decision: 'allow', reason: 'Read-only tool' };
  }
  if (mode === 'plan' && (EDIT_TOOLS.has(invocation.tool) || invocation.tool === 'shell')) {
    return { decision: 'deny', reason: 'Plan mode forbids mutations and shell execution' };
  }
  if (mode === 'auto-edit' && EDIT_TOOLS.has(invocation.tool)) {
    return { decision: 'allow', reason: 'Auto-edit mode permits file edits' };
  }
  if (mode === 'yolo' && invocation.tool !== 'shell') {
    return { decision: 'allow', reason: 'YOLO mode permits configured non-shell tools' };
  }
  return { decision: 'ask', reason: `Approval required for ${invocation.tool}` };
}

export function createApprovalHook(options: ApprovalPolicyOptions) {
  return async ({ toolCall, args }: { toolCall: Record<string, unknown>; args: unknown }) => {
    const functionCall = (toolCall as any).function ?? {};
    const result = decideApproval({
      tool: String(functionCall.name ?? ''),
      args: (args && typeof args === 'object' ? args : {}) as Record<string, unknown>,
    }, options);
    if (result.decision !== 'allow') return { block: true, reason: result.reason };
    return undefined;
  };
}
