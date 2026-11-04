/**
 * Shared tool catalogue for MCP server + TUI mission paths.
 * Applies T85 role-mcp-policy filter before returning.
 */
import { listDirTool, readFileTool, writeFileTool, globTool, fileOutlineTool, readLinesTool } from '../tools/file-tools.js';
import { shellTool } from '../tools/shell-tool.js';
import { editFileTool } from '../tools/file-edit.js';
import type { ToolDefinition } from '../tools/index.js';
import { getMCPTools } from './index.js';
import { filterToolsForWorkspaceRole, type RoleKey } from './role-mcp-policy.js';
import { wrapToolsWithStackFence } from '../agent/stack-fence.js';

const BUILTIN_TOOLS: ToolDefinition[] = [
  listDirTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  globTool,
  shellTool,
  fileOutlineTool,
  readLinesTool,
];

export async function buildMissionTools(opts: {
  workspaceRoot: string;
  role?: RoleKey;
  extra?: ToolDefinition[];
}): Promise<ToolDefinition[]> {
  const { searchSymbolsTool } = await import('../tools/index-tools.js');
  const { loadPluginTools } = await import('../tools/plugin-loader.js');

  const mcpTools = getMCPTools();
  const pluginTools = await loadPluginTools(opts.workspaceRoot);
  const catalog = [
    ...BUILTIN_TOOLS,
    searchSymbolsTool,
    ...mcpTools,
    ...pluginTools,
    ...(opts.extra ?? []),
  ];

  const filtered = filterToolsForWorkspaceRole(catalog, opts.workspaceRoot, opts.role ?? 'executor');
  // T88 — tool-level fence (defense in depth; hooks alone missed live React edits).
  return wrapToolsWithStackFence(filtered, opts.workspaceRoot);
}
