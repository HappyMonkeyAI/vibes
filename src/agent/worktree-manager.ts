import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export interface GitRunnerResult {
  stdout: string;
  stderr: string;
}

export type GitRunner = (args: string[], cwd: string) => Promise<GitRunnerResult>;

export async function getRepositoryStatus(
  repo: string,
  runGit: GitRunner = defaultGitRunner,
): Promise<string> {
  const result = await runGit(['status', '--porcelain'], repo);
  return result.stdout;
}

export async function isRepositoryClean(
  repo: string,
  runGit: GitRunner = defaultGitRunner,
): Promise<boolean> {
  return (await getRepositoryStatus(repo, runGit)).trim() === '';
}

export interface TaskWorktree {
  taskId: string;
  path: string;
  branch: string;
  baseRef: string;
}

function defaultGitRunner(args: string[], cwd: string): Promise<GitRunnerResult> {
  return execFileAsync('git', args, { cwd }).then(result => ({
    stdout: result.stdout,
    stderr: result.stderr,
  }));
}

function safeTaskSlug(taskId: string): string {
  const segments = taskId.split(/[\\/]/u);
  if (segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`unsafe task id: ${taskId}`);
  }

  const slug = taskId
    .replace(/[^A-Za-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (!slug || slug === '.' || slug === '..') {
    throw new Error(`unsafe task id: ${taskId}`);
  }
  return slug;
}

export function getTaskWorktreePath(repo: string, taskId: string): string {
  return path.join(repo, '.worktrees', safeTaskSlug(taskId));
}

export function getTaskBranchName(taskId: string): string {
  return `ag/${safeTaskSlug(taskId)}`;
}

export async function createTaskWorktree(options: {
  repo: string;
  taskId: string;
  baseRef?: string;
  runGit?: GitRunner;
}): Promise<TaskWorktree> {
  const baseRef = options.baseRef ?? 'HEAD';
  const worktreePath = getTaskWorktreePath(options.repo, options.taskId);
  const branch = getTaskBranchName(options.taskId);
  const runGit = options.runGit ?? defaultGitRunner;

  await runGit(
    ['worktree', 'add', '--quiet', worktreePath, '-b', branch, baseRef],
    options.repo,
  );

  return {
    taskId: options.taskId,
    path: worktreePath,
    branch,
    baseRef,
  };
}

export async function removeTaskWorktree(
  repo: string,
  taskId: string,
  runGit: GitRunner = defaultGitRunner,
): Promise<void> {
  await runGit(['worktree', 'remove', getTaskWorktreePath(repo, taskId)], repo);
}

/**
 * Merge only files declared by the task back into the parent checkout.
 * This deliberately does not run git reset, checkout, or clean.
 */
export async function mergeDeclaredTaskFiles(options: {
  repo: string;
  taskId: string;
  files: string[];
  runGit?: GitRunner;
}): Promise<string[]> {
  const worktree = getTaskWorktreePath(options.repo, options.taskId);
  const copied: string[] = [];
  for (const relativeFile of options.files) {
    if (!relativeFile || path.isAbsolute(relativeFile) || relativeFile.split(/[\\/]/u).includes('..')) {
      throw new Error(`unsafe task file: ${relativeFile}`);
    }
    const source = path.join(worktree, relativeFile);
    const destination = path.join(options.repo, relativeFile);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    copied.push(relativeFile);
  }
  await removeTaskWorktree(options.repo, options.taskId, options.runGit);
  return copied;
}
