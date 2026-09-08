import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';

import { assertCaptureContains, normalizeTuiCapture } from '../dist/tui/capture.js';

test('TUI capture normalization removes ANSI and normalizes line endings', async () => {
  const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/tui/mission-flow.ansi'), 'utf8');
  const normalized = normalizeTuiCapture(fixture);
  assert(!normalized.includes('\u001b['));
  assert(!normalized.includes('\r'));
  assertCaptureContains(fixture, [
    'Vibes Mission Control',
    'Minion Threads',
    'Thinking ▸ inspect workspace',
    'Approval required',
    'MISSION COMPLETED SUCCESSFULLY',
  ]);
});
