/**
 * Windows cannot execFile('npm') — the shim is npm.cmd (ENOENT without shell).
 * Use this for every Node spawn of the npm CLI.
 */
export function resolveNpmExecutable(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}
