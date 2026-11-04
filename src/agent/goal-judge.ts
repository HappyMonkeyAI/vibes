import { Task, GoalJudgeResult } from './types.js';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { log } from '../logger.js';
import { runStructuralAudit } from './structural-audit.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { runRepositoryAudit } from './repository-audit.js';
import { detectStackPolicy } from './stack-fence.js';
import { resolveNpmExecutable } from './npm-exec.js';

const execFileAsync = promisify(execFile);

/** Fence-blocked React probes must not be required to exist on vanilla-three workspaces. */
export function isFenceBlockedProbePath(file: string, workspaceRoot?: string): boolean {
  if (!/\.(tsx|jsx)$/i.test(file.replace(/\\/g, '/'))) return false;
  if (!workspaceRoot) return false;
  return detectStackPolicy(workspaceRoot) === 'vanilla-three';
}

export class GoalJudge {
  async evaluate(
    task: Task,
    workspaceRoot?: string,
  ): Promise<GoalJudgeResult> {
    const unmetCriteria: string[] = [];
    const baseDir = workspaceRoot || process.cwd();

    // --- Hard Evaluator Tier 1: Existence & Size Checks ---
    // Empty `files` is allowed (fence-only / verify leaves): skip existence, still require
    // acceptance criteria + done + output, then build when type=code.
    if (task.files && task.files.length > 0) {
      for (const file of task.files) {
        if (isFenceBlockedProbePath(file, baseDir)) {
          log(`Goal judge: skipping existence check for fence-blocked probe ${file}`, 'INFO');
          continue;
        }
        const fullPath = join(baseDir, file);
        try {
          if (!existsSync(fullPath)) {
            unmetCriteria.push(`Required file does not exist: ${file}`);
          } else {
            const stats = statSync(fullPath);
            const isExpectedEmpty = /empty/i.test(task.title) || /empty/i.test(task.description);
            if (stats.size === 0 && !isExpectedEmpty) {
              unmetCriteria.push(`Required file is empty: ${file}`);
            }
          }
        } catch {
          unmetCriteria.push(`Cannot access required file: ${file}`);
        }
      }
    }

    if (task.status === 'done' && (!task.output || task.output.trim().length === 0)) {
      unmetCriteria.push('Task completed without producing output');
    }

    if (task.status === 'done' && task.error) {
      unmetCriteria.push(`Task has error despite being done: ${task.error}`);
    }

    if (!task.acceptance_criteria || task.acceptance_criteria.length === 0) {
      unmetCriteria.push('No acceptance criteria defined for task');
    }

    if (task.status !== 'done') {
      unmetCriteria.push(`Task status is '${task.status}', expected 'done'`);
    }

    // Short circuit Tier 1 check if basic requirements fail
    if (unmetCriteria.length > 0) {
      const feedback = `Goal judge basic verification failed: ${unmetCriteria.join('; ')}`;
      log(`Goal judge evaluation failed (Tier 1 check) for task ${task.id}: ${feedback}`, 'WARN');
      return { approved: false, unmetCriteria, feedback };
    }

    // --- Hard Evaluator Tier 2: Structural Lint Checks (Structural Audit) ---
    if (task.files && task.files.length > 0) {
      const auditableFiles = task.files.filter((file) => !isFenceBlockedProbePath(file, baseDir));
      if (auditableFiles.length > 0) {
        const auditIssues = runStructuralAudit(baseDir, auditableFiles);
        if (auditIssues.length > 0) {
          const structuralErrors = auditIssues.map(i => `[${i.type}] ${i.file}: ${i.message}`);
          unmetCriteria.push(...structuralErrors);
          const feedback = `Structural audit found issues:\n${structuralErrors.map(e => `- ${e}`).join('\n')}`;
          log(`Goal judge evaluation failed (Tier 2 Structural Audit) for task ${task.id}: ${feedback}`, 'WARN');
          return { approved: false, unmetCriteria, feedback };
        }
      }
    }

    // --- Hard Evaluator Tier 3: Compiler / Build Checks ---
    if (task.type === 'code') {
      const buildErrors = await this.runBuildCheck(baseDir);
      if (buildErrors.length > 0) {
        unmetCriteria.push(...buildErrors);
        const feedback = `Build compilation failed with errors:\n${buildErrors.map(e => `- ${e}`).join('\n')}`;
        log(`Goal judge evaluation failed (Tier 3 Build Check) for task ${task.id}: ${feedback}`, 'WARN');
        return { approved: false, unmetCriteria, feedback };
      }
    }

    const repositoryWarnings = (await runRepositoryAudit(baseDir))
      .map(issue => `[${issue.type}] ${issue.file}: ${issue.message}`);
    return { approved: true, unmetCriteria: [], auditWarnings: repositoryWarnings };
  }

  /**
   * Runs the workspace compiler check to verify build integrity.
   */
  private async runBuildCheck(workspaceRoot: string): Promise<string[]> {
    try {
      const pkgPath = join(workspaceRoot, 'package.json');
      if (!existsSync(pkgPath)) return [];

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (!pkg.scripts || !pkg.scripts.build) return [];

      log('Running workspace build verification check...', 'INFO');
      await execFileAsync(resolveNpmExecutable(), ['run', 'build'], { cwd: workspaceRoot });
      return [];
    } catch (error: any) {
      const stdout = error.stdout ? String(error.stdout) : '';
      const stderr = error.stderr ? String(error.stderr) : '';
      const output = `${stdout}\n${stderr}`;

      const errorLines = output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('error TS') || line.includes('Error:') || line.includes('Failed to compile') || line.includes('ValidationError'));

      return errorLines.length > 0 ? errorLines.slice(0, 8) : [error.message || 'Build compilation check failed'];
    }
  }
}

export function createDefaultGoalJudge(): GoalJudge {
  return new GoalJudge();
}
