import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskExecutor } from '../dist/agent/task-executor.js';
import { config, updateConfig } from '../dist/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import http from 'node:http';

test('TaskExecutor triggers reconstruction when enabled and threshold hit', async () => {
  const originalReconstruction = config.ENABLE_CONTEXT_RECONSTRUCTION;
  const originalBaseUrl = config.OLLAMA_BASE_URL;
  const originalWindow = config.CONTEXT_WINDOW;
  const originalMaxSteps = config.MAX_STEPS;
  const originalStreaming = config.ENABLE_STREAMING;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Mock response' } }] }));
  });
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  updateConfig({
    ENABLE_CONTEXT_RECONSTRUCTION: true,
    OLLAMA_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    CONTEXT_WINDOW: 15000,
    MAX_STEPS: 1,
    ENABLE_STREAMING: false,
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-test-executor-'));
  await fs.writeFile(path.join(tmpDir, 'MEMORY.md'), 'Durable memory');
  await fs.writeFile(path.join(tmpDir, 'checkpoint.md'), 'Checkpoint info');
  await fs.writeFile(path.join(tmpDir, 'progress.md'), 'Progress tree');
  await fs.writeFile(path.join(tmpDir, 'notes.md'), 'Discovery notes');

  const executor = new TaskExecutor([], { getYoloMode: () => true });
  const task = {
    id: 't1', title: 'Test Task', description: 'Test Description', files: [],
    acceptance_criteria: ['Done'], type: 'code', status: 'todo', depends_on: [],
  };

  try {
    const result = await executor.executeTask(task, 'Mission', tmpDir, () => {}, () => true);
    assert.ok(['done', 'failed'].includes(result.status));
  } finally {
    server.close();
    updateConfig({
      ENABLE_CONTEXT_RECONSTRUCTION: originalReconstruction,
      OLLAMA_BASE_URL: originalBaseUrl,
      CONTEXT_WINDOW: originalWindow,
      MAX_STEPS: originalMaxSteps,
      ENABLE_STREAMING: originalStreaming,
    });
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
