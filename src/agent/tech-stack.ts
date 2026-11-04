import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export function detectTechStack(workspaceRoot: string): string[] {
  const stack = new Set<string>();

  // Helper to check for file extensions in a directory (shallow check for speed)
  function hasExtensionInDir(dir: string, extensions: string[]): boolean {
    try {
      if (!existsSync(dir)) return false;
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'venv') continue;
        if (extensions.some(ext => entry.endsWith(ext))) {
          return true;
        }
      }
    } catch {}
    return false;
  }

  // 1. Detect JS/TS/React via package.json
  const pkgPath = join(workspaceRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      stack.add('javascript');
      if (deps['typescript']) stack.add('typescript');
      if (deps['three']) stack.add('three');
      if (deps['react'] || deps['react-dom']) stack.add('react');
      if (deps['next']) {
        stack.add('nextjs');
        stack.add('react');
      }
      if (deps['vue']) stack.add('vue');
      // Vanilla three: declare explicitly so planners do not invent React.
      if (deps['three'] && !deps['react'] && !deps['react-dom'] && !deps['next'] && !deps['vue']) {
        stack.add('vanilla-three');
      }
    } catch {}
  }

  const pkgHasReact = (() => {
    try {
      if (!existsSync(pkgPath)) return false;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      return Boolean(deps.react || deps['react-dom'] || deps.next);
    } catch {
      return false;
    }
  })();

  // 2. Scan directories for files/configurations
  const srcDir = join(workspaceRoot, 'src');
  const targetDirs = [workspaceRoot, srcDir];

  for (const dir of targetDirs) {
    if (!existsSync(dir)) continue;

    // Do not infer React from stray .tsx when package.json has no react (T88 dogfood).
    if (hasExtensionInDir(dir, ['.tsx', '.jsx']) && (pkgHasReact || !existsSync(pkgPath))) {
      stack.add('react');
      stack.add('javascript');
    }
    if (hasExtensionInDir(dir, ['.ts'])) {
      stack.add('typescript');
      stack.add('javascript');
    }
    if (hasExtensionInDir(dir, ['.js', '.mjs', '.cjs'])) {
      stack.add('javascript');
    }
    if (hasExtensionInDir(dir, ['.css', '.scss', '.sass'])) {
      stack.add('css');
    }
    if (hasExtensionInDir(dir, ['.html'])) {
      stack.add('html');
    }
    if (existsSync(join(dir, 'requirements.txt')) || existsSync(join(dir, 'pyproject.toml')) || hasExtensionInDir(dir, ['.py'])) {
      stack.add('python');
    }
    if (existsSync(join(dir, 'Cargo.toml')) || hasExtensionInDir(dir, ['.rs'])) {
      stack.add('rust');
    }
    if (existsSync(join(dir, 'go.mod')) || hasExtensionInDir(dir, ['.go'])) {
      stack.add('go');
    }
  }

  if (stack.has('typescript')) stack.add('javascript');
  if (stack.has('react')) stack.add('javascript');

  return Array.from(stack);
}
