export const BRACKETED_PASTE_START = '\u001b[200~';
export const BRACKETED_PASTE_END = '\u001b[201~';

export const PASTE_BURST_THRESHOLD_MS = 100;
export const BRACKETED_PASTE_FLUSH_TIMEOUT_MS = 250;
export const SHIFT_HELD_TIMEOUT_MS = 1000;

export interface CursorPosition {
  line: number;
  col: number;
}

export interface NewlineIntentOptions {
  input: string;
  key: {
    return: boolean;
    shift: boolean;
    meta: boolean;
    ctrl: boolean;
  };
  isPasteSessionActive: boolean;
  shiftHeld: boolean;
  readlineShiftEnter?: boolean;
}

const MODIFIED_NEWLINE_SEQUENCES = [
  /^\u001b\[13;(?:2|3|5|6)(?:~|u)$/,
  /^\u001b\[27;13;(?:2|3|5|6)(?:~|u)$/,
  /^\u001b\[13;(?:2|3|5|6);[\d;]*(?:~|u)$/,
];

const SHIFT_MODIFIER_SEQUENCES = [
  /^\u001b\[5744[17](?:u|~)$/,
  /^\u001b\[27;5744[17](?:~|u)$/,
];

export function sanitizePastedText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function isModifiedNewlineSequence(input: string): boolean {
  return MODIFIED_NEWLINE_SEQUENCES.some((pattern) => pattern.test(input));
}

export function isShiftModifierSequence(input: string): boolean {
  return SHIFT_MODIFIER_SEQUENCES.some((pattern) => pattern.test(input));
}

export function isTerminalControlSequence(input: string): boolean {
  return input.startsWith('\u001b');
}

export function isPasteChunk(input: string): boolean {
  if (!input || isTerminalControlSequence(input)) return false;
  return input.length > 1 || input.includes('\n') || input.includes('\r');
}

export function shouldInsertNewline({
  input,
  key,
  isPasteSessionActive,
  shiftHeld,
  readlineShiftEnter = false,
}: NewlineIntentOptions): boolean {
  if (isPasteSessionActive) return true;
  if (isModifiedNewlineSequence(input)) return true;
  if (input === '\n') return true;
  if (key.meta || key.ctrl) return true;
  if (key.shift && key.return) return true;
  if (shiftHeld && key.return) return true;
  if (readlineShiftEnter && key.return) return true;
  return false;
}

export function insertNewlineAtCursor(value: string, cursor: CursorPosition): { value: string; cursor: CursorPosition } {
  const lines = value.split('\n');
  const currentLine = lines[cursor.line] ?? '';
  const lineStart = currentLine.slice(0, cursor.col);
  const lineEnd = currentLine.slice(cursor.col);
  const linesBefore = lines.slice(0, cursor.line);
  const linesAfter = lines.slice(cursor.line + 1);

  return {
    value: [...linesBefore, lineStart, lineEnd, ...linesAfter].join('\n'),
    cursor: { line: cursor.line + 1, col: 0 },
  };
}

export function insertTextAtCursor(
  value: string,
  text: string,
  cursor: CursorPosition,
): { value: string; cursor: CursorPosition } {
  const sanitized = sanitizePastedText(text);
  if (!sanitized) {
    return { value, cursor };
  }

  const lines = value.split('\n');
  const inputLines = sanitized.split('\n');

  if (inputLines.length === 1) {
    const currentLine = lines[cursor.line] ?? '';
    const newLine = currentLine.slice(0, cursor.col) + sanitized + currentLine.slice(cursor.col);
    const newLines = [...lines];
    newLines[cursor.line] = newLine;
    return {
      value: newLines.join('\n'),
      cursor: { line: cursor.line, col: cursor.col + sanitized.length },
    };
  }

  const currentLine = lines[cursor.line] ?? '';
  const lineStart = currentLine.slice(0, cursor.col);
  const lineEnd = currentLine.slice(cursor.col);
  const linesBefore = lines.slice(0, cursor.line);
  const linesAfter = lines.slice(cursor.line + 1);

  const newMiddleLines = [
    lineStart + inputLines[0],
    ...inputLines.slice(1, -1),
    inputLines[inputLines.length - 1] + lineEnd,
  ];

  const newCursorLine = cursor.line + inputLines.length - 1;
  const newCursorCol = inputLines[inputLines.length - 1].length;

  return {
    value: [...linesBefore, ...newMiddleLines, ...linesAfter].join('\n'),
    cursor: { line: newCursorLine, col: newCursorCol },
  };
}

export function cursorFromValueEnd(value: string): CursorPosition {
  const lines = value.split('\n');
  const lastLine = lines[lines.length - 1] ?? '';
  return { line: Math.max(0, lines.length - 1), col: lastLine.length };
}

export function applySequentialPasteChunks(chunks: string[], start: CursorPosition = { line: 0, col: 0 }) {
  let value = '';
  let cursor = start;
  for (const chunk of chunks) {
    const next = insertTextAtCursor(value, chunk, cursor);
    value = next.value;
    cursor = next.cursor;
  }
  return { value, cursor };
}