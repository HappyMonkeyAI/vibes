import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface RepositoryAuditIssue {
  type: 'deleted_test' | 'new_dependency' | 'superseded_api' | 'layering';
  file: string;
  message: string;
  severity: 'warning';
}

export interface RepositoryAuditOptions {
  supersededApis?: Record<string, string>;
  layeringRules?: Array<{ importPrefix: string; forbiddenFrom: string; message: string }>;
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

export function runRepositoryAudit(workspaceRoot: string, options: RepositoryAuditOptions = {}): RepositoryAuditIssue[] {
  const issues: RepositoryAuditIssue[] = [];
  try {
    if (git(workspaceRoot, ['rev-parse', '--is-inside-work-tree']).trim() !== 'true') return issues;
  } catch {
    return issues;
  }

  const status = git(workspaceRoot, ['diff', '--name-status', 'HEAD']);
  for (const line of status.split('\n').filter(Boolean)) {
    const [change, file] = line.split('\t');
    if (change === 'D' && /(?:^|\/)(?:test|tests|__tests__)(?:\/|\.)|\.test\.[cm]?[jt]sx?$/.test(file)) {
      issues.push({ type: 'deleted_test', file, severity: 'warning', message: 'A test file was deleted in the working tree.' });
    }
  }

  try {
    const before = JSON.parse(git(workspaceRoot, ['show', 'HEAD:package.json']));
    const after = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'));
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

  for (const [api, replacement] of Object.entries(options.supersededApis ?? {})) {
    const files = git(workspaceRoot, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean);
    for (const file of files) {
      const fullPath = path.join(workspaceRoot, file);
      if (!fs.existsSync(fullPath) || !/\.[cm]?[jt]sx?$/.test(file)) continue;
      if (fs.readFileSync(fullPath, 'utf8').includes(api)) {
        issues.push({ type: 'superseded_api', file, severity: 'warning', message: `Uses configured superseded API ${api}; prefer ${replacement}.` });
      }
    }
  }

  return issues;
}
