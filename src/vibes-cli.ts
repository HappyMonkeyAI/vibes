#!/usr/bin/env node

// Keep transitive dependency deprecations from corrupting the Ink display.
process.noDeprecation = true;

if (process.argv[2] === 'watch') {
  const workspaceRoot = process.env.VIBES_LAUNCH_DIR || process.cwd();
  const { startWatchDaemon } = await import('./agent/watcher.js');
  startWatchDaemon(workspaceRoot);
} else {
  await import('./index.js');
}
