import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runStructuralAudit } from '../dist/agent/structural-audit.js';

test('HTML <link href="styles.css"> clears css_orphan (static site)', () => {
  const root = mkdtempSync(join(tmpdir(), 'vibes-audit-html-css-'));
  writeFileSync(
    join(root, 'index.html'),
    '<!DOCTYPE html><html><head><link href="styles.css" rel="stylesheet"></head><body></body></html>\n',
  );
  writeFileSync(join(root, 'styles.css'), 'footer { background: #111; color: #eee; }\n');
  const issues = runStructuralAudit(root, ['styles.css']);
  assert.equal(
    issues.some((i) => i.type === 'css_orphan'),
    false,
    `unexpected orphan: ${JSON.stringify(issues)}`,
  );
});

test('unlinked theme.css is still reported as css_orphan', () => {
  const root = mkdtempSync(join(tmpdir(), 'vibes-audit-orphan-css-'));
  writeFileSync(join(root, 'index.html'), '<!DOCTYPE html><html><body></body></html>\n');
  writeFileSync(join(root, 'theme.css'), 'body { margin: 0; }\n');
  const issues = runStructuralAudit(root, ['theme.css']);
  assert.ok(issues.some((i) => i.type === 'css_orphan' && i.file.includes('theme.css')));
});
