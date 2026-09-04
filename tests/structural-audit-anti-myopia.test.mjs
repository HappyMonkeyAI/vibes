import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runStructuralAudit } from '../dist/agent/structural-audit.js';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vibes-audit-fixture-'));
  mkdirSync(join(root, 'src', 'components'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { react: '1' } }));
  writeFileSync(join(root, 'src', 'App.tsx'), 'export default function App() { return <div />; }');
  return root;
}

test('V0: an existing but unused component is rejected as dead code', () => {
  const root = fixture();
  writeFileSync(join(root, 'src', 'components', 'Skeleton.tsx'), 'export function Skeleton() { return <div />; }');
  const issues = runStructuralAudit(root, ['src/components/Skeleton.tsx']);
  assert.ok(issues.some(issue => issue.type === 'dead_code' && issue.file.endsWith('Skeleton.tsx')));
});

test('V1: importing the component into the real entrypoint clears the dead-code finding', () => {
  const root = fixture();
  writeFileSync(join(root, 'src', 'components', 'Skeleton.tsx'), 'export function Skeleton() { return <div />; }');
  writeFileSync(join(root, 'src', 'App.tsx'), "import { Skeleton } from './components/Skeleton';\nexport default function App() { return <Skeleton />; }");
  const issues = runStructuralAudit(root, ['src/components/Skeleton.tsx']);
  assert.equal(issues.some(issue => issue.type === 'dead_code'), false);
});
