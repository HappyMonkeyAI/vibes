import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { config } from '../config.js';
import { log } from '../logger.js';

// Rough token estimation: ~4 chars per token for English text
const CHARS_PER_TOKEN = 4;

// Reserve budget for the model's response and tool definitions
const RESPONSE_RESERVE_TOKENS = 4096;
const TOOL_SCHEMA_RESERVE_TOKENS = 2048;

/**
 * Estimates the token count of a string.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimates the total tokens used by a messages array.
 */
export function estimateMessagesTokens(messages: ChatCompletionMessageParam[]): number {
  let total = 0;
  for (const msg of messages) {
    // Per-message overhead (role, formatting)
    total += 4;
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part) {
          total += estimateTokens(part.text);
        }
      }
    }
    // Count tool calls in assistant messages
    if ('tool_calls' in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name);
        total += estimateTokens(tc.function.arguments);
      }
    }
  }
  return total;
}

/**
 * Returns the usable token budget (context window minus reserves).
 */
export function getUsableBudget(): number {
  return config.CONTEXT_WINDOW - RESPONSE_RESERVE_TOKENS - TOOL_SCHEMA_RESERVE_TOKENS;
}

/**
 * Truncates a string to fit within a max token budget, appending a notice.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const truncNotice = `\n\n[... truncated ${currentTokens - maxTokens} tokens to fit context window]`;
  return text.slice(0, maxChars - truncNotice.length) + truncNotice;
}

/**
 * Truncates tool result content to prevent a single result from
 * dominating the context window.
 * 
 * File reads get a generous budget; other results get a tighter one.
 */
export function truncateToolResult(content: string, toolName: string): string {
  // Budget per tool result: max 25% of usable budget or 6K tokens, whichever is smaller
  const maxPerResult = Math.min(Math.floor(getUsableBudget() * 0.25), 6144);

  const currentTokens = estimateTokens(content);
  if (currentTokens <= maxPerResult) return content;

  log(`Truncating ${toolName} result from ~${currentTokens} to ~${maxPerResult} tokens`, 'WARN');
  return truncateToTokenBudget(content, maxPerResult);
}

/**
 * Compresses the conversation history when it exceeds the context budget.
 * Strategy:
 *   1. System prompt (index 0) and initial user message (index 1) are always kept.
 *   2. The most recent N message pairs are kept intact for continuity.
 *   3. Middle messages are summarized into a single condensed message.
 */
export function compressMessages(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  const budget = getUsableBudget();
  const currentTokens = estimateMessagesTokens(messages);

  if (currentTokens <= budget) return messages;

  log(`Context compression triggered: ~${currentTokens} tokens exceeds ~${budget} budget`, 'WARN');

  // Always preserve: system (0), initial user (1), and last 6 messages
  const PRESERVE_HEAD = 2;
  const PRESERVE_TAIL = 6;

  if (messages.length <= PRESERVE_HEAD + PRESERVE_TAIL) {
    // Not enough messages to compress; truncate individual message contents instead
    return messages.map((msg, i) => {
      if (i === 0) return msg; // Keep system prompt intact
      if (typeof msg.content === 'string' && estimateTokens(msg.content) > 1024) {
        return { ...msg, content: truncateToTokenBudget(msg.content, 1024) };
      }
      return msg;
    });
  }

  const head = messages.slice(0, PRESERVE_HEAD);
  const tail = messages.slice(-PRESERVE_TAIL);
  const middle = messages.slice(PRESERVE_HEAD, messages.length - PRESERVE_TAIL);

  // Build a compressed summary of middle messages
  const summaryParts: string[] = [];
  for (const msg of middle) {
    if (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
      summaryParts.push(`[Agent] ${msg.content.slice(0, 150)}`);
    } else if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
      const calls = msg.tool_calls.map(tc => tc.function.name).join(', ');
      summaryParts.push(`[Agent called: ${calls}]`);
    } else if (msg.role === 'tool' && typeof msg.content === 'string') {
      const preview = msg.content.slice(0, 80);
      summaryParts.push(`[Tool result: ${preview}...]`);
    }
  }

  const summaryText = `[CONTEXT COMPRESSED - ${middle.length} messages summarized]\n` +
    summaryParts.join('\n');

  const summaryMessage: ChatCompletionMessageParam = {
    role: 'user',
    content: truncateToTokenBudget(summaryText, 1024),
  };

  const compressed = [...head, summaryMessage, ...tail];
  const newTokens = estimateMessagesTokens(compressed);
  log(`Context compressed: ~${currentTokens} → ~${newTokens} tokens (removed ${middle.length} messages)`, 'INFO');

  // If still over budget after compression, recursively compress
  if (newTokens > budget && compressed.length > PRESERVE_HEAD + PRESERVE_TAIL + 1) {
    return compressMessages(compressed);
  }

  return compressed;
}

/**
 * Returns context usage stats for the TUI display.
 */
export function getContextStats(messages: ChatCompletionMessageParam[]) {
  const used = estimateMessagesTokens(messages);
  const total = config.CONTEXT_WINDOW;
  const usable = getUsableBudget();
  const percentage = Math.round((used / usable) * 100);

  return { used, total, usable, percentage };
}
