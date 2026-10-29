import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decisionToolCandidates } from '../dist/agent/decision-mcp.js';

describe('decisionToolCandidates', () => {
  it('prefers system_one for Unsloth Studio URLs', () => {
    assert.deepEqual(
      decisionToolCandidates('http://192.168.5.157:8888/mcp/'),
      ['system_one', 'kev_evaluate'],
    );
    assert.deepEqual(
      decisionToolCandidates('https://unsloth.local/mcp/'),
      ['system_one', 'kev_evaluate'],
    );
  });

  it('prefers kev_evaluate for classic KEV URLs', () => {
    assert.deepEqual(
      decisionToolCandidates('http://192.168.5.157:8765/mcp'),
      ['kev_evaluate', 'system_one'],
    );
  });
});
