import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReconstructionController } from '../dist/agent/context-reconstruction.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

test('ReconstructionController.shouldReconstruct respect threshold and enabled flag', () => {
  const controller = new ReconstructionController({ enabled: true, threshold: 0.5 });
  
  // Mock messages that would exceed 50% budget
  const hugeMessage = 'a'.repeat(60000); 
  const messages = [{ role: 'user', content: hugeMessage }];
  
  assert.strictEqual(controller.shouldReconstruct(messages), false, 'Should be false below 50%');
  
  const evenHugerMessage = 'a'.repeat(120000);
  const messages2 = [{ role: 'user', content: evenHugerMessage }];
  assert.strictEqual(controller.shouldReconstruct(messages2), true, 'Should be true above 50%');
  
  const disabledController = new ReconstructionController({ enabled: false, threshold: 0.5 });
  assert.strictEqual(disabledController.shouldReconstruct(messages2), false, 'Should be false if disabled');
});

test('ReconstructionController.reconstruct reads state files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibes-test-'));
  
  await fs.writeFile(path.join(tmpDir, 'MEMORY.md'), '# Workspace Rules\n- Rule 1');
  await fs.writeFile(path.join(tmpDir, 'checkpoint.md'), '# Session Checkpoint\n- **Timestamp**: 2026-06-16');
  await fs.writeFile(path.join(tmpDir, 'progress.md'), '# Progress\n- [ ] task-1: Do something');
  await fs.writeFile(path.join(tmpDir, 'notes.md'), '# Notes\n## [2026-06-16]\nFound a bug');

  const controller = new ReconstructionController({ enabled: true });
  const messages = await controller.reconstruct(tmpDir);
  
  assert.strictEqual(messages.length, 1);
  const content = messages[0].content;
  assert.ok(content.includes('Rule 1'));
  assert.ok(content.includes('2026-06-16'));
  assert.ok(content.includes('task-1'));
  assert.ok(content.includes('Found a bug'));
  
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('ReconstructionController.getVerbatimTail preserves recent turns', () => {
  const controller = new ReconstructionController();
  const messages = [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'hi', tool_calls: [{ id: '1', function: { name: 't1', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: '1', content: 'res1' },
    { role: 'assistant', content: 'thought', tool_calls: [{ id: '2', function: { name: 't2', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: '2', content: 'res2' },
  ];
  
  const tail = controller.getVerbatimTail(messages, 1);
  assert.strictEqual(tail.length, 2);
  assert.strictEqual(tail[0].role, 'assistant');
  assert.strictEqual(tail[1].role, 'tool');
  assert.strictEqual(tail[0].content, 'thought');

  const tail2 = controller.getVerbatimTail(messages, 2);
  assert.strictEqual(tail2.length, 4);
  assert.strictEqual(tail2[0].role, 'assistant');
  assert.strictEqual(tail2[0].content, 'hi');
});
