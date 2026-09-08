import assert from 'node:assert/strict';
import test from 'node:test';

import { consumeChatCompletionStream } from '../dist/agent/stream-adapter.js';

test('consumeChatCompletionStream assembles content, reasoning, and tool-call deltas', async () => {
  const deltas = [];
  const stream = (async function* () {
    yield { choices: [{ delta: { role: 'assistant', reasoning_content: 'think ' } }] };
    yield { choices: [{ delta: { reasoning_content: 'more' } }] };
    yield { choices: [{ delta: { content: 'hello ' } }] };
    yield { choices: [{ delta: { content: 'world', tool_calls: [{ index: 0, id: 'call-1', function: { name: 'shell', arguments: '{"c' } }] } }] };
    yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'md":"pwd"}' } }] } }] };
  })();

  const message = await consumeChatCompletionStream(stream, delta => deltas.push(delta));

  assert.equal(message.content, 'hello world');
  assert.equal(message.reasoning_content, 'think more');
  assert.equal(message.tool_calls[0].function.name, 'shell');
  assert.equal(message.tool_calls[0].function.arguments, '{"cmd":"pwd"}');
  assert.deepEqual(deltas.map(delta => delta.kind), ['thinking', 'thinking', 'content', 'content', 'tool_call', 'tool_call']);
});

test('tool calls arriving out of index order assemble without holes', async () => {
  const stream = (async function* () {
    yield { choices: [{ delta: { tool_calls: [{ index: 1, id: 'call-b', function: { name: 'shell', arguments: '{}' } }] } }] };
    yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-a', function: { name: 'file_read', arguments: '{}' } }] } }] };
  })();

  const message = await consumeChatCompletionStream(stream);

  assert.equal(message.tool_calls.length, 2);
  assert.equal(message.tool_calls.every(call => call !== undefined), true);
  assert.deepEqual(message.tool_calls.map(call => call.id), ['call-a', 'call-b']);
});
