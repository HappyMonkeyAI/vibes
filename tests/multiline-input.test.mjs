import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BRACKETED_PASTE_END,
  BRACKETED_PASTE_START,
  applySequentialPasteChunks,
  cursorFromValueEnd,
  insertNewlineAtCursor,
  insertTextAtCursor,
  isModifiedNewlineSequence,
  isPasteChunk,
  sanitizePastedText,
  shouldInsertNewline,
} from '../dist/tui/components/multiline-input-helpers.js';

const MISSION_PROMPT =
  'Create a React project with a Button component, an Input component, a Card component, and a Badge component — all independent, no shared dependencies.';

test('sanitizePastedText converts carriage returns to newlines', () => {
  assert.equal(sanitizePastedText('line1\r\nline2\rline3'), 'line1\nline2\nline3');
});

test('insertTextAtCursor preserves multiline paste content', () => {
  const result = insertTextAtCursor('', 'alpha\nbeta\ngamma', { line: 0, col: 0 });
  assert.equal(result.value, 'alpha\nbeta\ngamma');
  assert.deepEqual(result.cursor, { line: 2, col: 5 });
});

test('insertTextAtCursor splits pasted lines at the cursor', () => {
  const result = insertTextAtCursor('hello world', 'foo\nbar', { line: 0, col: 5 });
  assert.equal(result.value, 'hellofoo\nbar world');
  assert.deepEqual(result.cursor, { line: 1, col: 3 });
});

test('sequential paste chunks accumulate instead of replacing earlier chunks', () => {
  const chunks = [
    'Create a React project with a Button component,',
    ' an Input component, a Card component,',
    ' and a Badge component — all independent, no shared dependencies.',
  ];
  const result = applySequentialPasteChunks(chunks);
  assert.equal(result.value, MISSION_PROMPT);
});

test('insertNewlineAtCursor splits the active line', () => {
  const result = insertNewlineAtCursor('hello world', { line: 0, col: 5 });
  assert.equal(result.value, 'hello\n world');
  assert.deepEqual(result.cursor, { line: 1, col: 0 });
});

test('shouldInsertNewline treats active paste sessions as newlines', () => {
  const base = {
    input: '',
    key: { return: true, shift: false, meta: false, ctrl: false },
    shiftHeld: false,
  };

  assert.equal(
    shouldInsertNewline({ ...base, isPasteSessionActive: true }),
    true,
  );
  assert.equal(
    shouldInsertNewline({ ...base, isPasteSessionActive: false }),
    false,
  );
});

test('shouldInsertNewline treats shift-enter and held-shift enter as newlines', () => {
  const base = {
    input: '',
    key: { return: true, shift: false, meta: false, ctrl: false },
    isPasteSessionActive: false,
  };

  assert.equal(
    shouldInsertNewline({ ...base, key: { ...base.key, shift: true } }),
    true,
  );
  assert.equal(
    shouldInsertNewline({ ...base, shiftHeld: true }),
    true,
  );
  assert.equal(
    shouldInsertNewline({ ...base, readlineShiftEnter: true }),
    true,
  );
  assert.equal(
    shouldInsertNewline({ ...base, input: '\u001b[13;2~' }),
    true,
  );
});

test('isModifiedNewlineSequence recognizes common shift-enter CSI variants', () => {
  assert.equal(isModifiedNewlineSequence('\u001b[13;2~'), true);
  assert.equal(isModifiedNewlineSequence('\u001b[13;2u'), true);
  assert.equal(isModifiedNewlineSequence('\u001b[27;13;2~'), true);
});

test('isPasteChunk ignores terminal control sequences', () => {
  assert.equal(isPasteChunk('\u001b[13;2~'), false);
  assert.equal(isPasteChunk('hello world'), true);
});

test('cursorFromValueEnd tracks the final line and column', () => {
  assert.deepEqual(cursorFromValueEnd('one\ntwo\nthree'), { line: 2, col: 5 });
});

test('bracketed paste markers are stable constants', () => {
  assert.equal(BRACKETED_PASTE_START, '\u001b[200~');
  assert.equal(BRACKETED_PASTE_END, '\u001b[201~');
});