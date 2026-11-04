/**
 * Hard stack fence for small-model dogfood (T88).
 * When package.json is vite+three without React, block tool calls that introduce React.
 * Runs even in YOLO — same fail-closed posture as explicit deny patterns.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApprovalResult, ToolInvocation } from './approval-policy.js';
import type { BeforeToolCallContext, BeforeToolCallResult } from './types.js';

export type StackPolicy = 'vanilla-three' | 'react' | 'unrestricted';

export interface PackageDeps {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const REACT_PATH = /\.(tsx|jsx)$/i;
const REACT_CONTENT =
  /\bfrom\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]|\brequire\s*\(\s*['"]react(?:-dom)?['"]\s*\)|@vitejs\/plugin-react|\bReactDOM\b|\bcreateRoot\s*\(|\bStrictMode\b|from\s+['"]next\/|@react-three\b/i;
const REACT_SHELL =
  /\bnpm\s+(?:i|install|add)\b[\s\S]*\breact(?:-dom)?\b|\bpnpm\s+add\b[\s\S]*\breact(?:-dom)?\b|\byarn\s+add\b[\s\S]*\breact(?:-dom)?\b|\bbun\s+add\b[\s\S]*\breact(?:-dom)?\b/i;
const REACT_PKG_KEY = /['"]react(?:-dom)?['"]\s*:/;

const MUTATING_TOOLS = new Set([
  'file_write',
  'file_edit',
  'write_file',
  'edit_file',
  'apply_patch',
  'shell',
]);

export function readPackageDeps(workspaceRoot: string): PackageDeps | null {
  const pkgPath = join(workspaceRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
    };
  } catch {
    return null;
  }
}

/** Policy from package.json only — stray .tsx debris must not unlock React. */
export function detectStackPolicy(workspaceRoot: string): StackPolicy {
  const depsFile = readPackageDeps(workspaceRoot);
  if (!depsFile) return 'unrestricted';
  const deps = { ...depsFile.dependencies, ...depsFile.devDependencies };
  const hasReact = Boolean(deps.react || deps['react-dom'] || deps.next);
  const hasThree = Boolean(deps.three);
  if (hasReact) return 'react';
  if (hasThree) return 'vanilla-three';
  return 'unrestricted';
}

export function stackFenceReason(policy: StackPolicy = 'vanilla-three'): string {
  return (
    `Stack fence (${policy}): this workspace is Vite + Three without React. ` +
    'Do not create .tsx/.jsx files, import react/react-dom, or install React. Use vanilla TypeScript + Three.js + DOM.'
  );
}

function haystacks(invocation: ToolInvocation): string[] {
  const values: string[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (depth > 5) return;
    if (typeof value === 'string') values.push(value);
    else if (Array.isArray(value)) for (const item of value) visit(item, depth + 1);
    else if (value && typeof value === 'object') {
      for (const item of Object.values(value)) visit(item, depth + 1);
    }
  };
  visit(invocation.args, 0);
  return values;
}

function pathLooksReact(pathValue: string): boolean {
  return REACT_PATH.test(pathValue.replace(/\\/g, '/'));
}

/** Returns a deny result when the invocation violates the workspace stack policy. */
export function evaluateStackFence(
  invocation: ToolInvocation,
  policy: StackPolicy,
): ApprovalResult | null {
  if (policy !== 'vanilla-three') return null;
  if (!MUTATING_TOOLS.has(invocation.tool)) return null;

  const args = invocation.args ?? {};
  const pathArg = typeof args.path === 'string' ? args.path : typeof args.file_path === 'string' ? args.file_path : '';
  if (pathArg && pathLooksReact(pathArg)) {
    return { decision: 'deny', reason: stackFenceReason(policy) };
  }

  for (const text of haystacks(invocation)) {
    if (REACT_CONTENT.test(text) || REACT_PKG_KEY.test(text)) {
      return { decision: 'deny', reason: stackFenceReason(policy) };
    }
    if (invocation.tool === 'shell') {
      if (REACT_SHELL.test(text)) {
        return { decision: 'deny', reason: stackFenceReason(policy) };
      }
      if (/\.(tsx|jsx)\b/i.test(text) && /\b(?:touch|echo|>|out-file|set-content|new-item|cat\s*>)\b/i.test(text)) {
        return { decision: 'deny', reason: stackFenceReason(policy) };
      }
    } else if (pathLooksReact(text)) {
      return { decision: 'deny', reason: stackFenceReason(policy) };
    }
  }

  return null;
}

export function createStackFenceHook(workspaceRoot: string) {
  const policy = detectStackPolicy(workspaceRoot);
  return async ({ toolCall, args }: BeforeToolCallContext): Promise<BeforeToolCallResult | void> => {
    if (policy !== 'vanilla-three') return undefined;
    const functionCall = (toolCall as { function?: { name?: string } })?.function ?? {};
    const invocation: ToolInvocation = {
      tool: String(functionCall.name ?? ''),
      args: (args && typeof args === 'object' ? args : {}) as Record<string, unknown>,
    };
    const denied = evaluateStackFence(invocation, policy);
    if (denied?.decision === 'deny') {
      return { block: true, reason: denied.reason };
    }
    return undefined;
  };
}

/** Run hooks in order; first block wins. */
export function composeBeforeToolCallHooks(
  ...hooks: Array<((ctx: BeforeToolCallContext) => Promise<BeforeToolCallResult | void>) | undefined | null>
) {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | void> => {
    for (const hook of hooks) {
      if (!hook) continue;
      const result = await hook(ctx);
      if (result && typeof result === 'object' && 'block' in result && result.block) {
        return result;
      }
    }
    return undefined;
  };
}

export function stackFencePlannerNote(workspaceRoot: string): string {
  if (detectStackPolicy(workspaceRoot) !== 'vanilla-three') return '';
  return (
    '\n[STACK FENCE — HARD]: package.json has `three` and no `react`. ' +
    'Plan and implement with vanilla TypeScript + Three.js + DOM only. ' +
    'Never propose React, Next, .tsx, or react-dom. Tool calls that introduce React will be blocked.\n'
  );
}

type ExecutableTool = {
  name: string;
  execute: (args: any, context?: { workspaceRoot: string }) => Promise<{ success: boolean; error?: string; data?: unknown }>;
};

/**
 * Wrap tool.execute so the fence cannot be skipped when beforeToolCall hooks
 * are missing/overwritten (live dogfood: React edits landed with 0 fence hits).
 * Policy is locked at wrap time from package.json.
 */
export function wrapToolsWithStackFence<T extends ExecutableTool>(
  tools: T[],
  workspaceRoot: string,
): T[] {
  const policy = detectStackPolicy(workspaceRoot);
  if (policy !== 'vanilla-three') return tools;

  return tools.map((tool) => {
    if (!MUTATING_TOOLS.has(tool.name)) return tool;
    const inner = tool.execute.bind(tool);
    return {
      ...tool,
      execute: async (args: any, context?: { workspaceRoot: string }) => {
        const denied = evaluateStackFence(
          { tool: tool.name, args: (args && typeof args === 'object' ? args : {}) as Record<string, unknown> },
          policy,
        );
        if (denied?.decision === 'deny') {
          return { success: false, error: denied.reason };
        }
        return inner(args, context);
      },
    };
  });
}
