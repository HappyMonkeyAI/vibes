import type { ExecFileOptions } from 'child_process';

/**
 * Windows cannot execFile('npm') — the PATH entry is a `.cmd` shim.
 * Use `npm.cmd` + `shell: true` (Node EINVAL otherwise) for every npm spawn.
 */
export function resolveNpmExecutable(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

/** Options to merge into execFile for npm on the current platform. */
export function npmExecFileOptions(
  extra: ExecFileOptions = {},
  platform: NodeJS.Platform = process.platform,
): ExecFileOptions {
  return platform === 'win32' ? { ...extra, shell: true } : { ...extra };
}
