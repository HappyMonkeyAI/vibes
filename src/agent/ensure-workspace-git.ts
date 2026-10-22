import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pre-mission git snapshot (TUI parity for MCP). Scratch folders often have a
 * broken `.git` (HEAD only) left by a failed init — treat that as "not a repo"
 * and recreate so evidence handoff can read branch/status.
 */
export function ensureWorkspaceGitSnapshot(workspaceRoot: string, missionId: string): void {
  const cwd = workspaceRoot;
  const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    encoding: 'utf8',
  });
  if (inside.stdout?.trim() === 'true') {
    spawnSync('git', ['commit', '-am', `vibes: pre-mission snapshot ${missionId}`, '--allow-empty'], {
      cwd,
      encoding: 'utf8',
    });
    return;
  }

  const gitDir = join(cwd, '.git');
  if (existsSync(gitDir)) {
    // Incomplete clone/init — remove and recreate so later git calls succeed.
    try {
      rmSync(gitDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  spawnSync('git', ['init'], { cwd, encoding: 'utf8' });
  spawnSync('git', ['add', '-A'], { cwd, encoding: 'utf8' });
  spawnSync('git', ['commit', '--allow-empty', '-m', `vibes: initial workspace snapshot ${missionId}`], {
    cwd,
    encoding: 'utf8',
  });
}
