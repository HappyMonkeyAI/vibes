export type StreamDelta =
  | { kind: 'thinking'; content: string }
  | { kind: 'content'; content: string }
  | { kind: 'tool_call'; index: number; id?: string; name?: string; arguments: string };

export interface AssembledChatMessage {
  role: 'assistant';
  content: string;
  reasoning_content?: string;
  tool_calls: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

/** Consume an OpenAI-compatible async stream without coupling the executor to SDK internals. */
export async function consumeChatCompletionStream(
  stream: AsyncIterable<any>,
  onDelta?: (delta: StreamDelta) => void,
): Promise<AssembledChatMessage> {
  let content = '';
  let reasoning = '';
  const tools: AssembledChatMessage['tool_calls'] = [];

  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta;
    if (!delta) continue;

    const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoningDelta === 'string' && reasoningDelta) {
      reasoning += reasoningDelta;
      onDelta?.({ kind: 'thinking', content: reasoningDelta });
    }

    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      onDelta?.({ kind: 'content', content: delta.content });
    }

    for (const toolDelta of delta.tool_calls ?? []) {
      const index = Number(toolDelta.index ?? 0);
      const existing = tools[index] ?? {
        id: toolDelta.id ?? `call-${index}`,
        type: 'function' as const,
        function: { name: '', arguments: '' },
      };
      if (toolDelta.id) existing.id = toolDelta.id;
      if (toolDelta.function?.name) existing.function.name += toolDelta.function.name;
      if (toolDelta.function?.arguments) existing.function.arguments += toolDelta.function.arguments;
      tools[index] = existing;
      onDelta?.({
        kind: 'tool_call',
        index,
        id: toolDelta.id,
        name: toolDelta.function?.name,
        arguments: toolDelta.function?.arguments ?? '',
      });
    }
  }

  return {
    role: 'assistant',
    content,
    ...(reasoning ? { reasoning_content: reasoning } : {}),
    tool_calls: tools,
  };
}

export function isAsyncChatCompletionStream(value: unknown): value is AsyncIterable<any> {
  return !!value && typeof (value as any)[Symbol.asyncIterator] === 'function';
}
