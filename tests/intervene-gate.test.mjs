import assert from 'node:assert/strict';
import test from 'node:test';

import { decideInterveneAction, toAutoResolution } from '../dist/agent/intervene-gate.js';

test('escalate when choice missing', () => {
  const r = decideInterveneAction({});
  assert.equal(r.action, 'escalate');
  assert.equal(toAutoResolution(r.action), null);
});

test('continue when continue clearly wins', () => {
  const r = decideInterveneAction({
    choice: 'continue',
    probabilities: { continue: 0.55, escalate: 0.25, skip: 0.2 },
  });
  assert.equal(r.action, 'continue');
  assert.equal(toAutoResolution(r.action)?.action, 'retry');
});

test('escalate on near-tie margins', () => {
  const r = decideInterveneAction({
    choice: 'escalate',
    probabilities: { escalate: 0.3875, continue: 0.3732, skip: 0.2393 },
    minMargin: 0.05,
  });
  assert.equal(r.action, 'escalate');
});

test('prefer probability argmax over mismatched choice', () => {
  const r = decideInterveneAction({
    choice: 'skip',
    probabilities: { continue: 0.7, escalate: 0.2, skip: 0.1 },
  });
  assert.equal(r.action, 'continue');
});

test('T54 escalate continue when confidence below floor', () => {
  const r = decideInterveneAction({
    choice: 'continue',
    probabilities: { continue: 0.62, escalate: 0.29, skip: 0.08 },
    confidence: 0.22,
  });
  assert.equal(r.action, 'escalate');
  assert.match(r.reason, /confidence 0\.220 < 0\.35/i);
  assert.equal(toAutoResolution(r.action), null);
});

test('T54 keep continue when confidence meets floor', () => {
  const r = decideInterveneAction({
    choice: 'continue',
    probabilities: { continue: 0.7, escalate: 0.2, skip: 0.1 },
    confidence: 0.55,
  });
  assert.equal(r.action, 'continue');
});
