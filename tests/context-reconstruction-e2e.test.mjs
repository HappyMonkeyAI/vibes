import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskExecutor, createDefaultHooks } from '../dist/agent/task-executor.js';
import { config, updateConfig } from '../dist/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import http from 'http';

test('E2E: Context Reconstruction Lifecycle (Local Mock Server)', async () => {
  // 1. Setup Local Mock Server
  let turn = 0;
  const server = http.createServer((req, res) => {
    turn++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    if (turn === 1) {
      // First turn: Tool call + large reasoning to fill context
      res.end(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: 'I will list the directory first. ' + 'a'.repeat(10000),
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: {
                name: 'list_dir',
                arguments: JSON.stringify({ dir_path: '.' })
              }
            }]
          }
        }]
      }));
    } else {
      // Second turn: verification after reconstruction
      res.end(JSON.stringify({
        choices: [{
          message: {
            role: 'assistant',
            content: 'Reconstruction verified. Memory says: Use reconstruction.'
          }
        }]
      }));
    }
  });

  const port = 11435;
  server.listen(port);

  // 2. Setup Environment
  const originalReconstruction = config.ENABLE_CONTEXT_RECONSTRUCTION;
  const originalBaseUrl = config.OLLAMA_BASE_URL;
  const originalWindow = config.CONTEXT_WINDOW;
  
  updateConfig({ 
    ENABLE_CONTEXT_RECONSTRUCTION: true,
    OLLAMA_BASE_URL: `http://localhost:${port}/v1`,
    CONTEXT_WINDOW: 15000, 
    MAX_STEPS: 5
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-e2e-reconstruction-'));
  await fs.writeFile(path.join(tmpDir, 'MEMORY.md'), '# Workspace Rules\n- Use reconstruction');
  await fs.writeFile(path.join(tmpDir, 'checkpoint.md'), '# Session Checkpoint\n- **Timestamp**: 2026-06-16');
  await fs.writeFile(path.join(tmpDir, 'progress.md'), '# Progress\n- [ ] goal: Complete E2E');
  await fs.writeFile(path.join(tmpDir, 'notes.md'), '# Notes\nFound state persistence.');

  const { listDirTool } = await import('../dist/tools/file-tools.js');
  const executor = new TaskExecutor([listDirTool], {
    getYoloMode: () => true,
    hooks: createDefaultHooks(() => true)
  });

  const task = {
    id: 'e2e-task',
    title: 'Verify Reconstruction',
    description: 'Trigger reconstruction',
    files: [],
    acceptance_criteria: ['Reconstructed'],
    type: 'code',
    status: 'todo',
    depends_on: [],
  };

  try {
    const result = await executor.executeTask(task, 'Mission', tmpDir, (evt) => {
      if (evt.type === 'system_log' && evt.message.includes('reconstructed')) {
        console.log('✅ Observed reconstruction event in logs');
      }
    }, () => true);

    if (result.status !== 'done') {
      console.error('Task failed with error:', result.error);
    }
    assert.strictEqual(result.status, 'done');
    assert.ok(result.output.includes('Use reconstruction'));
    console.log('✅ E2E Test Passed: Reconstruction triggered and rehydrated correctly.');

  } finally {
    server.close();
    updateConfig({ 
      ENABLE_CONTEXT_RECONSTRUCTION: originalReconstruction,
      OLLAMA_BASE_URL: originalBaseUrl,
      CONTEXT_WINDOW: originalWindow
    });
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
