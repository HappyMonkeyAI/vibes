/**
 * Desktop T84 writes `.vibes/role-mcp-policy.json`. T85 activates it here:
 * filter + budget the tool catalogue before the model sees it.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ToolDefinition } from '../tools/index.js';
import { log } from '../logger.js';

export type RoleKey = 'default' | 'planner' | 'executor' | 'reviewer' | 'triage';

export interface RoleMcpPolicyEntry {
  servers: string[];
  tools: string[];
  toolBudget: number;
  toolBudgetMode?: 'auto' | 'manual';
  contextWindow?: number | null;
}

export interface RoleMcpPolicyFile {
  v: number;
  at?: number;
  roles: Partial<Record<RoleKey, RoleMcpPolicyEntry>>;
}

export function roleMcpPolicyPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', 'role-mcp-policy.json');
}

export function loadRoleMcpPolicy(workspaceRoot: string): RoleMcpPolicyFile | null {
  const file = roleMcpPolicyPath(workspaceRoot);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as RoleMcpPolicyFile;
    if (!raw || typeof raw !== 'object' || !raw.roles || typeof raw.roles !== 'object') {
      return null;
    }
    return raw;
  } catch (error: any) {
    log(`Failed to read role-mcp-policy.json: ${error?.message ?? error}`, 'WARN');
    return null;
  }
}

export function policyForRole(
  file: RoleMcpPolicyFile | null | undefined,
  role: RoleKey,
): RoleMcpPolicyEntry | null {
  if (!file?.roles) return null;
  const entry = file.roles[role] ?? file.roles.executor ?? file.roles.default;
  if (!entry || typeof entry !== 'object') return null;
  return {
    servers: Array.isArray(entry.servers) ? entry.servers.filter((s) => typeof s === 'string') : [],
    tools: Array.isArray(entry.tools) ? entry.tools.filter((s) => typeof s === 'string') : [],
    toolBudget:
      typeof entry.toolBudget === 'number' && Number.isFinite(entry.toolBudget) && entry.toolBudget > 0
        ? Math.floor(entry.toolBudget)
        : 16,
    toolBudgetMode: entry.toolBudgetMode === 'manual' ? 'manual' : 'auto',
    contextWindow: entry.contextWindow ?? null,
  };
}

/** Match `mcp_<server>_<tool>` preferring the longest server key. */
export function mcpServerFromToolName(toolName: string, knownServers: string[] = []): string | null {
  if (!toolName.startsWith('mcp_')) return null;
  const rest = toolName.slice(4);
  const candidates = [...knownServers].sort((a, b) => b.length - a.length);
  for (const server of candidates) {
    if (server && rest.startsWith(`${server}_`)) return server;
  }
  // Fallback: first underscore segment (servers with hyphens stay intact).
  const idx = rest.indexOf('_');
  if (idx <= 0) return null;
  return rest.slice(0, idx);
}

function toolShortName(toolName: string, server: string | null): string {
  if (server && toolName.startsWith(`mcp_${server}_`)) {
    return toolName.slice(`mcp_${server}_`.length);
  }
  return toolName;
}

function matchesToolAllowlist(toolName: string, allow: string[], server: string | null): boolean {
  if (allow.length === 0) return true;
  const short = toolShortName(toolName, server);
  return allow.includes(toolName) || allow.includes(short);
}

/**
 * Filter then budget. Empty server/tool allowlists = unrestricted on that axis.
 * Budget always applies (small-LLM critical). Builtins are kept before MCP tools.
 */
export function applyRoleToolPolicy(
  tools: ToolDefinition[],
  policy: RoleMcpPolicyEntry | null | undefined,
): ToolDefinition[] {
  if (!policy) return tools;

  const servers = policy.servers.map((s) => s.trim()).filter(Boolean);
  const allowTools = policy.tools.map((t) => t.trim()).filter(Boolean);
  const budget = Math.max(1, policy.toolBudget || 16);

  const filtered = tools.filter((tool) => {
    const isMcp = tool.name.startsWith('mcp_');
    if (isMcp && servers.length > 0) {
      const server = mcpServerFromToolName(tool.name, servers);
      if (!server || !servers.includes(server)) return false;
    }
    const server = isMcp ? mcpServerFromToolName(tool.name, servers) : null;
    return matchesToolAllowlist(tool.name, allowTools, server);
  });

  if (filtered.length <= budget) return filtered;

  const builtins = filtered.filter((t) => !t.name.startsWith('mcp_'));
  const mcp = filtered.filter((t) => t.name.startsWith('mcp_'));
  const keptBuiltins = builtins.slice(0, budget);
  const remaining = Math.max(0, budget - keptBuiltins.length);
  return [...keptBuiltins, ...mcp.slice(0, remaining)];
}

/** Convenience: load policy for workspace + role and filter. */
export function filterToolsForWorkspaceRole(
  tools: ToolDefinition[],
  workspaceRoot: string,
  role: RoleKey = 'executor',
): ToolDefinition[] {
  const file = loadRoleMcpPolicy(workspaceRoot);
  const policy = policyForRole(file, role);
  if (!policy) return tools;
  const before = tools.length;
  const after = applyRoleToolPolicy(tools, policy);
  if (after.length !== before) {
    log(
      `Role MCP policy (${role}): ${before} → ${after.length} tools (budget=${policy.toolBudget}, servers=${policy.servers.length || 'all'}, tools=${policy.tools.length || 'all'})`,
      'INFO',
    );
  }
  return after;
}
