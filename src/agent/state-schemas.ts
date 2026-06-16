import { z } from 'zod';

/**
 * ============================================================================
 * STATE FILE PERSISTENCE RULES & SYNC TRIGGERS (REFERENCE ARCHITECTURE)
 * ============================================================================
 * 
 * 1. MEMORY.md (Project Memory)
 *    - Sync Trigger: Initialization and manual updates.
 *    - Description: Stores persistent workspace rules, stack assumptions, 
 *      constraints, and directories. Immutable during normal context flushes.
 * 
 * 2. checkpoint.md (Session Checkpoint)
 *    - Sync Trigger: Upon successful test runs and/or 5-minute periodic intervals.
 *    - Description: Captures active environment variables, dirty file buffers, 
 *      Git SHA, and test execution history to facilitate recovery.
 * 
 * 3. notes.md (Scratch Notes)
 *    - Sync Trigger: Immediately when an agent execution block/turn closes.
 *    - Description: Houses unstructured developer logs, discovery details, 
 *      and scratchpad telemetry.
 * 
 * 4. progress.md (Task Logs / Progress Tree)
 *    - Sync Trigger: Pre- and post-model interaction cycles.
 *    - Description: Keeps a hierarchical checklist of micro-objectives, 
 *      tracking status (todo, in_progress, done, blocked).
 */

// ============================================================================
// 1. MEMORY.md Schema & Parsers
// ============================================================================

export const MemoryMetadataSchema = z.object({
  type: z.literal('project-memory').default('project-memory'),
  tags: z.array(z.string()).default([]),
  created: z.string(),
  blast_radius: z.string().default('low'),
  confidence: z.number().default(1.0),
});
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;

export const MemorySchema = z.object({
  metadata: MemoryMetadataSchema,
  workspace_rules: z.array(z.string()).default([]),
  stack_assumptions: z.array(z.string()).default([]),
  workspace_constraints: z.array(z.string()).default([]),
  absolute_directories: z.array(z.string()).default([]),
});
export type Memory = z.infer<typeof MemorySchema>;

// ============================================================================
// 2. checkpoint.md Schema & Parsers
// ============================================================================

export const DirtyFileSchema = z.object({
  path: z.string(),
  size: z.number().optional(),
  status: z.enum(['modified', 'added', 'deleted', 'untracked', 'unknown']).default('unknown'),
  hash: z.string().optional(),
});
export type DirtyFile = z.infer<typeof DirtyFileSchema>;

export const CheckpointSchema = z.object({
  timestamp: z.string(),
  git_sha: z.string(),
  env_vars: z.record(z.string(), z.string()).default({}),
  dirty_files: z.array(DirtyFileSchema).default([]),
  last_test_run: z.object({
    status: z.enum(['passed', 'failed', 'unknown']),
    timestamp: z.string(),
    summary: z.string().optional(),
  }).optional(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

// ============================================================================
// 3. notes.md Schema & Parsers
// ============================================================================

export const NoteEntrySchema = z.object({
  timestamp: z.string(),
  category: z.string().optional(),
  content: z.string(),
});
export type NoteEntry = z.infer<typeof NoteEntrySchema>;

export const NotesSchema = z.object({
  entries: z.array(NoteEntrySchema).default([]),
});
export type Notes = z.infer<typeof NotesSchema>;

// ============================================================================
// 4. progress.md Schema & Parsers
// ============================================================================

export const ProgressStatusSchema = z.enum(['todo', 'in_progress', 'done', 'blocked']);
export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

export interface ProgressNode {
  id: string;
  title: string;
  status: ProgressStatus;
  children?: ProgressNode[];
}

export const ProgressNodeSchema: z.ZodType<ProgressNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    status: ProgressStatusSchema,
    children: z.array(ProgressNodeSchema).optional(),
  })
);

export const ProgressSchema = z.object({
  goals: z.array(ProgressNodeSchema).default([]),
});
export type Progress = z.infer<typeof ProgressSchema>;

// ============================================================================
// HELPER FUNCTIONS (YAML FRONTMATTER PARSING/SERIALIZATION)
// ============================================================================

export function parseFrontmatter(markdown: string): { frontmatter: Record<string, any>; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: markdown };
  }
  const rawYaml = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};
  
  const lines = rawYaml.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check if it's a list item under a key
    if (trimmed.startsWith('-') && currentKey && currentArray) {
      const val = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '');
      currentArray.push(val);
      frontmatter[currentKey] = currentArray;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    // Check inline list like [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      const items = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      frontmatter[key] = items;
      currentKey = null;
      currentArray = null;
    } else if (val === '') {
      currentKey = key;
      currentArray = [];
      frontmatter[key] = currentArray;
    } else {
      let parsedVal: any = val.replace(/^['"]|['"]$/g, '');
      if (parsedVal === 'true') parsedVal = true;
      else if (parsedVal === 'false') parsedVal = false;
      else if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = Number(parsedVal);
      frontmatter[key] = parsedVal;
      currentKey = null;
      currentArray = null;
    }
  }

  return { frontmatter, body };
}

export function serializeFrontmatter(frontmatter: Record<string, any>): string {
  let yaml = '---\n';
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        yaml += `${key}: []\n`;
      } else {
        yaml += `${key}:\n`;
        for (const item of val) {
          yaml += `  - ${item}\n`;
        }
      }
    } else {
      yaml += `${key}: ${val}\n`;
    }
  }
  yaml += '---\n';
  return yaml;
}

// ============================================================================
// PARSER & SERIALIZER IMPLEMENTATIONS
// ============================================================================

function parseMarkdownSections(body: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  const lines = body.split(/\r?\n/);
  let currentSection: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      currentSection = trimmed.replace(/^#+\s*/, '').trim().toLowerCase().replace(/\s+/g, '_');
      sections[currentSection] = [];
    } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      if (currentSection) {
        const item = trimmed.slice(1).trim();
        sections[currentSection].push(item);
      }
    }
  }
  return sections;
}

// Memory MD
export function parseMemory(markdown: string): Memory {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const sections = parseMarkdownSections(body);
  const parsedMetadata = MemoryMetadataSchema.parse(frontmatter);
  
  return MemorySchema.parse({
    metadata: parsedMetadata,
    workspace_rules: sections['workspace_rules'] || [],
    stack_assumptions: sections['stack_assumptions'] || [],
    workspace_constraints: sections['workspace_constraints'] || [],
    absolute_directories: sections['absolute_directories'] || [],
  });
}

export function serializeMemory(data: Memory): string {
  let md = serializeFrontmatter(data.metadata);
  md += '\n# Workspace Rules\n';
  data.workspace_rules.forEach(r => md += `- ${r}\n`);
  md += '\n# Stack Assumptions\n';
  data.stack_assumptions.forEach(a => md += `- ${a}\n`);
  md += '\n# Workspace Constraints\n';
  data.workspace_constraints.forEach(c => md += `- ${c}\n`);
  md += '\n# Absolute Directories\n';
  data.absolute_directories.forEach(d => md += `- ${d}\n`);
  return md;
}

// Checkpoint MD
export function parseCheckpoint(markdown: string): Checkpoint {
  const lines = markdown.split(/\r?\n/);
  let timestamp = '';
  let git_sha = '';
  let last_test_run: Checkpoint['last_test_run'] = undefined;
  const env_vars: Record<string, string> = {};
  const dirty_files: DirtyFile[] = [];

  let currentSection: 'root' | 'env' | 'dirty' = 'root';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## Environment Variables')) {
      currentSection = 'env';
      continue;
    } else if (trimmed.startsWith('## Dirty Files')) {
      currentSection = 'dirty';
      continue;
    } else if (trimmed.startsWith('#')) {
      continue;
    }

    if (currentSection === 'root') {
      if (trimmed.startsWith('- **Timestamp**:')) {
        timestamp = trimmed.replace('- **Timestamp**:', '').trim();
      } else if (trimmed.startsWith('- **Git SHA**:')) {
        git_sha = trimmed.replace('- **Git SHA**:', '').trim();
      } else if (trimmed.startsWith('- **Test Status**:')) {
        const testLine = trimmed.replace('- **Test Status**:', '').trim();
        const match = testLine.match(/^(passed|failed|unknown)\s*\(at\s*([^)]+)\)(?:\s*-\s*(.*))?$/);
        if (match) {
          last_test_run = {
            status: match[1] as any,
            timestamp: match[2].trim(),
            summary: match[3]?.trim(),
          };
        }
      }
    } else if (currentSection === 'env') {
      const match = trimmed.match(/^-\s*`([^`]+)`:\s*(.*)$/);
      if (match) {
        env_vars[match[1]] = match[2].trim();
      }
    } else if (currentSection === 'dirty') {
      if (trimmed.startsWith('|') && !trimmed.includes('---') && !trimmed.includes('Path')) {
        const parts = trimmed.split('|').map(s => s.trim());
        if (parts.length >= 5) {
          const path = parts[1];
          const sizeStr = parts[2];
          const status = parts[3];
          const hash = parts[4];
          if (path) {
            dirty_files.push({
              path,
              size: sizeStr ? Number(sizeStr) : undefined,
              status: status as any,
              hash: hash || undefined,
            });
          }
        }
      }
    }
  }

  return CheckpointSchema.parse({
    timestamp,
    git_sha,
    env_vars,
    dirty_files,
    last_test_run,
  });
}

export function serializeCheckpoint(data: Checkpoint): string {
  let md = `# Session Checkpoint\n\n`;
  md += `- **Timestamp**: ${data.timestamp}\n`;
  md += `- **Git SHA**: ${data.git_sha}\n`;
  if (data.last_test_run) {
    md += `- **Test Status**: ${data.last_test_run.status} (at ${data.last_test_run.timestamp})`;
    if (data.last_test_run.summary) {
      md += ` - ${data.last_test_run.summary}`;
    }
    md += '\n';
  }
  md += `\n## Environment Variables\n`;
  for (const [key, value] of Object.entries(data.env_vars)) {
    md += `- \`${key}\`: ${value}\n`;
  }
  md += `\n## Dirty Files\n`;
  if (data.dirty_files.length === 0) {
    md += `No dirty files.\n`;
  } else {
    md += `| Path | Size | Status | Hash |\n`;
    md += `|------|------|--------|------|\n`;
    for (const file of data.dirty_files) {
      md += `| ${file.path} | ${file.size ?? ''} | ${file.status} | ${file.hash ?? ''} |\n`;
    }
  }
  return md;
}

// Notes MD
export function parseNotes(markdown: string): Notes {
  const lines = markdown.split(/\r?\n/);
  const entries: NoteEntry[] = [];
  let currentTimestamp: string | null = null;
  let currentCategory: string | null = null;
  let currentContent: string[] = [];

  const commitCurrentEntry = () => {
    if (currentTimestamp) {
      const entry: any = {
        timestamp: currentTimestamp,
        content: currentContent.join('\n').trim(),
      };
      if (currentCategory) {
        entry.category = currentCategory;
      }
      entries.push(entry);
    }
    currentTimestamp = null;
    currentCategory = null;
    currentContent = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(/^##\s*\[([^\]]+)\](?:\s+(.*))?$/);
    if (headerMatch) {
      commitCurrentEntry();
      currentTimestamp = headerMatch[1].trim();
      currentCategory = headerMatch[2]?.trim() || null;
    } else if (line.startsWith('#') && !headerMatch) {
      commitCurrentEntry();
    } else {
      if (currentTimestamp !== null) {
        currentContent.push(line);
      }
    }
  }
  commitCurrentEntry();

  return NotesSchema.parse({ entries });
}

export function serializeNotes(data: Notes): string {
  let md = `# Notes\n\n`;
  for (const entry of data.entries) {
    const categorySuffix = entry.category ? ` ${entry.category}` : '';
    md += `## [${entry.timestamp}]${categorySuffix}\n`;
    md += `${entry.content.trim()}\n\n`;
  }
  return md;
}

// Progress MD
export function parseProgress(markdown: string): Progress {
  const lines = markdown.split(/\r?\n/);
  const goals: ProgressNode[] = [];
  
  interface StackEntry {
    node: ProgressNode;
    indent: number;
  }
  const stack: StackEntry[] = [];

  for (const line of lines) {
    // Match structure like: - [x] task-id: Title
    const match = line.match(/^(\s*)-\s*\[([ x/b!])\]\s*([^:]+):\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const statusChar = match[2];
    const id = match[3].trim();
    const title = match[4].trim();

    let status: ProgressStatus = 'todo';
    if (statusChar === 'x') status = 'done';
    else if (statusChar === '/') status = 'in_progress';
    else if (statusChar === 'b' || statusChar === '!') status = 'blocked';

    const node: ProgressNode = { id, title, status };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      goals.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      parent.children = parent.children || [];
      parent.children.push(node);
    }

    stack.push({ node, indent });
  }

  return ProgressSchema.parse({ goals });
}

export function serializeProgress(data: Progress): string {
  let md = `# Progress\n\n`;

  function serializeNode(node: ProgressNode, depth: number): string {
    const indent = '  '.repeat(depth);
    let statusChar = ' ';
    if (node.status === 'done') statusChar = 'x';
    else if (node.status === 'in_progress') statusChar = '/';
    else if (node.status === 'blocked') statusChar = '!';

    let result = `${indent}- [${statusChar}] ${node.id}: ${node.title}\n`;
    if (node.children) {
      for (const child of node.children) {
        result += serializeNode(child, depth + 1);
      }
    }
    return result;
  }

  for (const goal of data.goals) {
    md += serializeNode(goal, 0);
  }
  return md;
}
