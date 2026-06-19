/**
 * Strip reasoning preamble and extract the raw JSON string from a model response.
 *
 * Handles three cases, in order:
 *   1. Closed <think>...</think> block  — strip with non-greedy regex, then find JSON.
 *   2. Unclosed <think> block (model cut off mid-reasoning) — strip everything
 *      up to the first '{' that appears at the start of a line (the real JSON root).
 *   3. Markdown code fences (```json ... ```) — strip fences.
 *
 * Exported as `extractJsonContent` for use by mission-planner and other callers
 * that want the cleaned string before attempting JSON.parse.
 */
export function extractJsonContent(text: string): string {
  let trimmed = text.trim();

  // Case 1: fully closed <think>...</think> block(s)
  if (/<\/think>/i.test(trimmed)) {
    trimmed = trimmed.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } else if (/<think>/i.test(trimmed)) {
    // Case 2: unclosed <think> — since it is unclosed, the model cut off during reasoning
    // and did not produce the actual JSON output. Strip the entire <think> block to avoid
    // extracting placeholder JSON examples from within the thinking monologue.
    trimmed = trimmed.replace(/<think>[\s\S]*/i, '').trim();
  }

  // Strip markdown code fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch && fenceMatch[1]) {
    trimmed = fenceMatch[1].trim();
  }

  return trimmed;
}

/**
 * Extract JSON object from text that may contain preamble (thinking tokens, etc.)
 * Internal helper used by repairJson.  Returns null when no JSON object/array
 * root delimiter is found.
 */
function extractJson(text: string): string | null {
  let trimmed = extractJsonContent(text);

  // Try to find a complete JSON object: first '{' to matching '}'
  const start = trimmed.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (!escaped && ch === '"') inStr = !inStr;
    if (!inStr) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    escaped = !escaped && ch === '\\';
    if (depth === 0 && i > start) {
      return trimmed.slice(start, i + 1);
    }
  }
  // No closing brace found — return from start onward
  return trimmed.slice(start);
}

/**
 * Attempts to repair common JSON errors from LLMs
 */
export function repairJson(json: string): string | null {
  const extracted = extractJson(json);
  if (extracted === null) return null;

  let repaired = extracted.trim();

  // Step A: Close any unclosed string
  let inString = false;
  let escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
        escaped = false;
      }
    }
  }

  if (inString) {
    // Truncated inside string.
    // Count trailing backslashes to check if the last backslash escapes our closing quote
    let backslashCount = 0;
    for (let i = repaired.length - 1; i >= 0; i--) {
      if (repaired[i] === '\\') {
        backslashCount++;
      } else {
        break;
      }
    }
    if (backslashCount % 2 !== 0) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }

  // Step B: Trim trailing whitespace
  repaired = repaired.trim();

  // Step C: Handle trailing colon or comma
  while (repaired.endsWith(':') || repaired.endsWith(',')) {
    if (repaired.endsWith(':')) {
      repaired += ' null';
      break;
    }
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1).trim();
    }
  }

  // Step D: Handle partial keywords or numbers
  const lastWordMatch = repaired.match(/[a-zA-Z0-9_\.+\-]+$/);
  if (lastWordMatch) {
    const word = lastWordMatch[0];
    const isTrue = word === 'true';
    const isFalse = word === 'false';
    const isNull = word === 'null';
    const isNumber = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(word);

    if (!isTrue && !isFalse && !isNull && !isNumber) {
      let replacement = 'null';
      if (word.startsWith('t') && 'true'.startsWith(word)) {
        replacement = 'true';
      } else if (word.startsWith('f') && 'false'.startsWith(word)) {
        replacement = 'false';
      } else if (word.startsWith('n') && 'null'.startsWith(word)) {
        replacement = 'null';
      }
      repaired = repaired.slice(0, -word.length) + replacement;
    }
  }

  // Step E: Handle key name ending (if it ends with a string, check if it's a key and needs a colon + value)
  if (repaired.endsWith('"')) {
    let lastStringStart = -1;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (inStr) {
        if (esc) {
          esc = false;
        } else if (char === '\\') {
          esc = true;
        } else if (char === '"') {
          inStr = false;
        }
      } else {
        if (char === '"') {
          inStr = true;
          esc = false;
          lastStringStart = i;
        }
      }
    }

    if (lastStringStart !== -1) {
      let prevChar = '';
      for (let i = lastStringStart - 1; i >= 0; i--) {
        if (/\s/.test(repaired[i])) continue;
        prevChar = repaired[i];
        break;
      }
      if (prevChar === '{' || prevChar === ',') {
        repaired += ': null';
      }
    }
  }

  // Step F: Close open braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
        escaped = false;
      } else if (char === '{') {
        openBraces++;
        stack.push('{');
      } else if (char === '}') {
        openBraces--;
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === '[') {
        openBrackets++;
        stack.push('[');
      } else if (char === ']') {
        openBrackets--;
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  // Close from stack in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] === '{') {
      repaired += '}';
    } else if (stack[i] === '[') {
      repaired += ']';
    }
  }

  return repaired;
}
