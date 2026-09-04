#!/usr/bin/env node
/**
 * Harness micro-benchmarks. Measures the hot paths the ADR-0007 contracts added —
 * envelope construction, stream assembly, and live-event folding — against the
 * thresholds in tests/fixtures/benchmarks/baseline.json.
 *
 * Usage: npm run bench:harness  (add --json for machine-readable output)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const asJson = process.argv.includes('--json');
const baselinePath = path.join(process.cwd(), 'tests/fixtures/benchmarks/baseline.json');
const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));

const coldStart = performance.now();
const { createExecutionEnvelope } = await import('../../dist/agent/types.js');
const { consumeChatCompletionStream } = await import('../../dist/agent/stream-adapter.js');
const { applyLiveEvents, createLiveEventState } = await import('../../dist/tui/event-view-model.js');
const coldStartMs = performance.now() - coldStart;

function time(fn) {
  const started = performance.now();
  return Promise.resolve(fn()).then(() => performance.now() - started);
}

const { envelope10k, stream100Chunks, liveViewModel1kDeltas } = baseline.workloads;

const results = {
  coldStart: coldStartMs,

  envelope10k: await time(() => {
    for (let i = 0; i < envelope10k; i += 1) {
      createExecutionEnvelope({ type: 'output', content: 'x' }, {
        runId: 'run', missionId: 'mission', taskId: 'task', sequence: i,
      });
    }
  }),

  stream100Chunks: await time(async () => {
    const stream = (async function* () {
      for (let i = 0; i < stream100Chunks; i += 1) {
        yield { choices: [{ delta: { content: 'token ' } }] };
      }
    })();
    await consumeChatCompletionStream(stream);
  }),

  liveViewModel1kDeltas: await time(() => {
    const batch = Array.from({ length: liveViewModel1kDeltas }, (_, i) => (
      i % 10 === 0
        ? { type: 'output', content: String(i) }
        : { type: 'output_delta', content: 'x' }
    ));
    applyLiveEvents(createLiveEventState(), batch);
  }),
};

const rows = Object.entries(results).map(([name, ms]) => {
  const threshold = baseline.thresholdsMs[name];
  return { name, ms: Number(ms.toFixed(2)), thresholdMs: threshold, pass: threshold === undefined || ms <= threshold };
});
const failed = rows.filter(row => !row.pass);

if (asJson) {
  console.log(JSON.stringify({ name: baseline.name, rows, pass: failed.length === 0 }, null, 2));
} else {
  console.log(`\n${baseline.name}\n`);
  for (const row of rows) {
    console.log(`  ${row.pass ? '✓' : '✗'} ${row.name.padEnd(24)} ${String(row.ms).padStart(8)} ms  (budget ${row.thresholdMs} ms)`);
  }
  console.log('');
}

if (failed.length > 0) {
  console.error(`Over budget: ${failed.map(row => row.name).join(', ')}`);
  process.exit(1);
}
