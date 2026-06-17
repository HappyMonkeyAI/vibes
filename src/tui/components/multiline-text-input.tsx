import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import {
  BRACKETED_PASTE_END,
  BRACKETED_PASTE_START,
  BRACKETED_PASTE_FLUSH_TIMEOUT_MS,
  PASTE_BURST_THRESHOLD_MS,
  SHIFT_HELD_TIMEOUT_MS,
  cursorFromValueEnd,
  insertNewlineAtCursor,
  insertTextAtCursor,
  isModifiedNewlineSequence,
  isPasteChunk,
  isShiftModifierSequence,
  shouldInsertNewline,
} from './multiline-input-helpers.js';
import { consumeShiftEnterIntent } from '../shift-key-tracker.js';

interface Props {
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  isFocused?: boolean;
}

export function MultilineTextInput({ defaultValue = '', placeholder = '', onChange, onSubmit, isFocused = true }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [cursorPosition, setCursorPosition] = useState(() => cursorFromValueEnd(defaultValue));
  const valueRef = useRef(defaultValue);
  const cursorRef = useRef(cursorFromValueEnd(defaultValue));
  const bracketedPasteActiveRef = useRef(false);
  const bracketedPasteBufferRef = useRef('');
  const bracketedPasteCursorRef = useRef(cursorRef.current);
  const bracketedPasteFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pasteSessionActiveRef = useRef(false);
  const pasteSessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shiftHeldRef = useRef(false);
  const shiftHeldTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstRender = useRef(true);

  const syncEditorState = useCallback((nextValue: string, nextCursor: { line: number; col: number }) => {
    valueRef.current = nextValue;
    cursorRef.current = nextCursor;
    setValue(nextValue);
    setCursorPosition(nextCursor);
  }, []);

  const clearPasteSession = useCallback(() => {
    if (pasteSessionTimeoutRef.current) {
      clearTimeout(pasteSessionTimeoutRef.current);
      pasteSessionTimeoutRef.current = null;
    }
    pasteSessionActiveRef.current = false;
  }, []);

  const markPasteSession = useCallback(() => {
    pasteSessionActiveRef.current = true;
    if (pasteSessionTimeoutRef.current) {
      clearTimeout(pasteSessionTimeoutRef.current);
    }
    pasteSessionTimeoutRef.current = setTimeout(() => {
      pasteSessionActiveRef.current = false;
      pasteSessionTimeoutRef.current = null;
    }, PASTE_BURST_THRESHOLD_MS);
  }, []);

  const clearBracketedPasteFlush = useCallback(() => {
    if (bracketedPasteFlushTimeoutRef.current) {
      clearTimeout(bracketedPasteFlushTimeoutRef.current);
      bracketedPasteFlushTimeoutRef.current = null;
    }
  }, []);

  const flushBracketedPaste = useCallback(() => {
    const buffer = bracketedPasteBufferRef.current;
    bracketedPasteBufferRef.current = '';
    bracketedPasteActiveRef.current = false;
    clearBracketedPasteFlush();
    clearPasteSession();

    if (!buffer) {
      return;
    }

    const pasteCursor = bracketedPasteCursorRef.current;
    const next = insertTextAtCursor(valueRef.current, buffer, pasteCursor);
    syncEditorState(next.value, next.cursor);
  }, [clearBracketedPasteFlush, clearPasteSession, syncEditorState]);

  const scheduleBracketedPasteFlush = useCallback(() => {
    clearBracketedPasteFlush();
    bracketedPasteFlushTimeoutRef.current = setTimeout(() => {
      bracketedPasteFlushTimeoutRef.current = null;
      flushBracketedPaste();
    }, BRACKETED_PASTE_FLUSH_TIMEOUT_MS);
  }, [clearBracketedPasteFlush, flushBracketedPaste]);

  const insertAtCursor = useCallback((text: string) => {
    const next = insertTextAtCursor(valueRef.current, text, cursorRef.current);
    syncEditorState(next.value, next.cursor);
  }, [syncEditorState]);

  const markShiftHeld = useCallback(() => {
    shiftHeldRef.current = true;
    if (shiftHeldTimeoutRef.current) {
      clearTimeout(shiftHeldTimeoutRef.current);
    }
    shiftHeldTimeoutRef.current = setTimeout(() => {
      shiftHeldRef.current = false;
      shiftHeldTimeoutRef.current = null;
    }, SHIFT_HELD_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      clearPasteSession();
      clearBracketedPasteFlush();
      if (shiftHeldTimeoutRef.current) {
        clearTimeout(shiftHeldTimeoutRef.current);
      }
    };
  }, [clearBracketedPasteFlush, clearPasteSession]);

  const lines = value.split('\n');

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChange?.(value);
  }, [value, onChange]);

  useEffect(() => {
    const nextCursor = cursorFromValueEnd(defaultValue);
    valueRef.current = defaultValue;
    cursorRef.current = nextCursor;
    setValue(defaultValue);
    setCursorPosition(nextCursor);
  }, [defaultValue]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (input === BRACKETED_PASTE_START) {
      bracketedPasteActiveRef.current = true;
      bracketedPasteBufferRef.current = '';
      bracketedPasteCursorRef.current = cursorRef.current;
      markPasteSession();
      scheduleBracketedPasteFlush();
      return;
    }

    if (input === BRACKETED_PASTE_END) {
      flushBracketedPaste();
      return;
    }

    if (bracketedPasteActiveRef.current) {
      if (key.return) {
        bracketedPasteBufferRef.current += '\n';
      } else if (input) {
        bracketedPasteBufferRef.current += input;
      }
      markPasteSession();
      scheduleBracketedPasteFlush();
      return;
    }

    if (key.shift || isShiftModifierSequence(input)) {
      markShiftHeld();
      if (isShiftModifierSequence(input)) {
        return;
      }
    }

    if (isModifiedNewlineSequence(input)) {
      const next = insertNewlineAtCursor(valueRef.current, cursorRef.current);
      syncEditorState(next.value, next.cursor);
      return;
    }

    const wantsNewline = shouldInsertNewline({
      input,
      key,
      isPasteSessionActive: pasteSessionActiveRef.current,
      shiftHeld: shiftHeldRef.current,
      readlineShiftEnter: consumeShiftEnterIntent(key.return || input === '\n'),
    });

    if (key.return || input === '\n') {
      if (wantsNewline) {
        const next = insertNewlineAtCursor(valueRef.current, cursorRef.current);
        syncEditorState(next.value, next.cursor);
      } else {
        clearPasteSession();
        onSubmit?.(valueRef.current);
        syncEditorState('', { line: 0, col: 0 });
      }
      return;
    }

    if (key.upArrow) {
      if (cursorRef.current.line > 0) {
        const nextLine = cursorRef.current.line - 1;
        const nextCol = Math.min(cursorRef.current.col, lines[nextLine]?.length ?? 0);
        const nextCursor = { line: nextLine, col: nextCol };
        cursorRef.current = nextCursor;
        setCursorPosition(nextCursor);
      }
      clearPasteSession();
      return;
    }

    if (key.downArrow) {
      if (cursorRef.current.line < lines.length - 1) {
        const nextLine = cursorRef.current.line + 1;
        const nextCol = Math.min(cursorRef.current.col, lines[nextLine]?.length ?? 0);
        const nextCursor = { line: nextLine, col: nextCol };
        cursorRef.current = nextCursor;
        setCursorPosition(nextCursor);
      }
      clearPasteSession();
      return;
    }

    if (key.leftArrow) {
      if (cursorRef.current.col > 0) {
        const nextCursor = { ...cursorRef.current, col: cursorRef.current.col - 1 };
        cursorRef.current = nextCursor;
        setCursorPosition(nextCursor);
      } else if (cursorRef.current.line > 0) {
        const prevLine = cursorRef.current.line - 1;
        const nextCursor = { line: prevLine, col: lines[prevLine]?.length ?? 0 };
        cursorRef.current = nextCursor;
        setCursorPosition(nextCursor);
      }
      clearPasteSession();
      return;
    }

    if (key.rightArrow) {
      const currentLine = lines[cursorRef.current.line] ?? '';
      if (cursorRef.current.col < currentLine.length) {
        const nextCursor = { ...cursorRef.current, col: cursorRef.current.col + 1 };
        cursorRef.current = nextCursor;
        setCursorPosition(nextCursor);
      } else if (cursorRef.current.line < lines.length - 1) {
        const nextCursor = { line: cursorRef.current.line + 1, col: 0 };
        cursorRef.current = nextCursor;
        setCursorPosition(nextCursor);
      }
      clearPasteSession();
      return;
    }

    if (key.home) {
      const nextCursor = { ...cursorRef.current, col: 0 };
      cursorRef.current = nextCursor;
      setCursorPosition(nextCursor);
      clearPasteSession();
      return;
    }

    if (key.end) {
      const currentLine = lines[cursorRef.current.line] ?? '';
      const nextCursor = { ...cursorRef.current, col: currentLine.length };
      cursorRef.current = nextCursor;
      setCursorPosition(nextCursor);
      clearPasteSession();
      return;
    }

    if (key.backspace) {
      const currentLines = valueRef.current.split('\n');
      const cursor = cursorRef.current;

      if (cursor.col > 0) {
        const currentLine = currentLines[cursor.line] ?? '';
        const newLine = currentLine.slice(0, cursor.col - 1) + currentLine.slice(cursor.col);
        const newLines = [...currentLines];
        newLines[cursor.line] = newLine;
        const nextCursor = { ...cursor, col: cursor.col - 1 };
        syncEditorState(newLines.join('\n'), nextCursor);
      } else if (cursor.line > 0) {
        const prevLine = currentLines[cursor.line - 1] ?? '';
        const currentLine = currentLines[cursor.line] ?? '';
        const newCol = prevLine.length;
        const newLines = [
          ...currentLines.slice(0, cursor.line - 1),
          prevLine + currentLine,
          ...currentLines.slice(cursor.line + 1),
        ];
        syncEditorState(newLines.join('\n'), { line: cursor.line - 1, col: newCol });
      }
      clearPasteSession();
      return;
    }

    if (key.delete) {
      const currentLines = valueRef.current.split('\n');
      const cursor = cursorRef.current;
      const currentLine = currentLines[cursor.line] ?? '';
      const isAtEndOfText = cursor.line === currentLines.length - 1 && cursor.col >= currentLine.length;

      if (isAtEndOfText) {
        if (cursor.col > 0) {
          const newLine = currentLine.slice(0, cursor.col - 1) + currentLine.slice(cursor.col);
          const newLines = [...currentLines];
          newLines[cursor.line] = newLine;
          syncEditorState(newLines.join('\n'), { ...cursor, col: cursor.col - 1 });
        } else if (cursor.line > 0) {
          const prevLine = currentLines[cursor.line - 1] ?? '';
          const newCol = prevLine.length;
          const newLines = [
            ...currentLines.slice(0, cursor.line - 1),
            prevLine + currentLine,
            ...currentLines.slice(cursor.line + 1),
          ];
          syncEditorState(newLines.join('\n'), { line: cursor.line - 1, col: newCol });
        }
      } else if (cursor.col < currentLine.length) {
        const newLine = currentLine.slice(0, cursor.col) + currentLine.slice(cursor.col + 1);
        const newLines = [...currentLines];
        newLines[cursor.line] = newLine;
        syncEditorState(newLines.join('\n'), cursor);
      } else if (cursor.line < currentLines.length - 1) {
        const nextLine = currentLines[cursor.line + 1] ?? '';
        const newLines = [
          ...currentLines.slice(0, cursor.line),
          currentLine + nextLine,
          ...currentLines.slice(cursor.line + 2),
        ];
        syncEditorState(newLines.join('\n'), cursor);
      }
      clearPasteSession();
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      if (isPasteChunk(input)) {
        markPasteSession();
      } else {
        clearPasteSession();
      }
      insertAtCursor(input);
    }
  });

  return (
    <Box flexDirection="column">
      {value.length === 0 && (!isFocused || (cursorPosition.line === 0 && cursorPosition.col === 0)) ? (
        <Text color="gray">{isFocused ? chalk.inverse(' ') + placeholder.slice(1) : placeholder}</Text>
      ) : (
        lines.map((line, lineIdx) => {
          const isCursorLine = isFocused && lineIdx === cursorPosition.line;

          let renderedLine = '';
          if (isCursorLine) {
            renderedLine += line.slice(0, cursorPosition.col);
            const cursorChar = cursorPosition.col < line.length ? line[cursorPosition.col] : ' ';
            renderedLine += chalk.inverse(cursorChar);
            renderedLine += line.slice(cursorPosition.col + 1);
          } else {
            renderedLine = line || ' ';
          }

          return <Text key={lineIdx} wrap="wrap">{renderedLine}</Text>;
        })
      )}
    </Box>
  );
}