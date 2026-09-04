import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface RepositoryAuditIssue {
  type: 'deleted_test' | 'new_dependency' | 'superseded_api';
  file: string;
  message: string;
  severity: 'warning';
}

export interface RepositoryAuditOptions {
  supersededApis?: Record<string, string>;
}

const TEST_PATH = /(?:^|\/)(?:test|tests|__tests__)(?:\/|\.)|\.test\.[cm]?[jt]sx?$/;
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function readIfExists(fullPath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(fullPath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Non-blocking warnings about repository history the goal judge cannot see in the
 * task output alone: tests that vanished, dependencies that appeared, and use of
 * APIs the project has moved away from.
 */
export async function runRepositoryAudit(
  workspaceRoot: string,
  options: RepositoryAuditOptions = {},
): Promise<RepositoryAuditIssue[]> {
  const issues: RepositoryAuditIssue[] = [];
  try {
    if ((await git(workspaceRoot, ['rev-parse', '--is-inside-work-tree'])).trim() !== 'true') return issues;
  } catch {
    return issues;
  }

  try {
    const status = await git(workspaceRoot, ['diff', '--name-status', 'HEAD']);
    for (const line of status.split('\n').filter(Boolean)) {
      const [change, file] = line.split('\t');
      if (change === 'D' && file && TEST_PATH.test(file)) {
        issues.push({ type: 'deleted_test', file, severity: 'warning', message: 'A test file was deleted in the working tree.' });
      }
    }
  } catch {
    // A repository with no HEAD yet has nothing to compare against.
  }

  try {
    const before = JSON.parse(await git(workspaceRoot, ['show', 'HEAD:package.json']));
    const after = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'package.json'), 'utf8'));
    for (const section of ['dependencies', 'devDependencies']) {
      for (const name of Object.keys(after[section] ?? {})) {
        if (!(name in (before[section] ?? {}))) {
          issues.push({ type: 'new_dependency', file: 'package.json', severity: 'warning', message: `New ${section} dependency: ${name}` });
        }
      }
    }
  } catch {
    // Non-package repositories and malformed package files are outside this audit's scope.
  }

  const supersededApis = Object.entries(options.supersededApis ?? {});
  if (supersededApis.length > 0) {
    try {
      // Resolve the changed-file list once, not once per configured API.
      const files = (await git(workspaceRoot, ['diff', '--name-only', 'HEAD']))
        .split('\n')
        .filter(file => file && SOURCE_FILE.test(file));

      for (const file of files) {
        const content = await readIfExists(path.join(workspaceRoot, file));
        if (content === undefined) continue;
        for (const [api, replacement] of supersededApis) {
          if (content.includes(api)) {
            issues.push({ type: 'superseded_api', file, severity: 'warning', message: `Uses configured superseded API ${api}; prefer ${replacement}.` });
          }
        }
      }
    } catch {
      // Same rationale as above: the audit is advisory and must never fail a task.
    }
  }

  return issues;
}
