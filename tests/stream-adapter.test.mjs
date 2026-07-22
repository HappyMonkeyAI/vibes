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
