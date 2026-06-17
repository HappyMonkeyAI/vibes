import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

interface Props {
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  isFocused?: boolean;
}

export function MultilineTextInput({ defaultValue = '', placeholder = '', onChange, onSubmit, isFocused = true }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [cursorPosition, setCursorPosition] = useState({ line: 0, col: defaultValue.length });
  const firstRender = useRef(true);

  // Derive lines for rendering and navigation
  const lines = value.split('\n');

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChange?.(value);
  }, [value, onChange]);

  useEffect(() => {
    setValue(defaultValue);
    const initialLines = defaultValue.split('\n');
    setCursorPosition({ 
      line: initialLines.length - 1, 
      col: initialLines[initialLines.length - 1].length 
    });
  }, [defaultValue]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.return) {
      if (key.shift) {
        // Insert newline
        const linesBefore = lines.slice(0, cursorPosition.line);
        const currentLine = lines[cursorPosition.line];
        const lineStart = currentLine.slice(0, cursorPosition.col);
        const lineEnd = currentLine.slice(cursorPosition.col);
        const linesAfter = lines.slice(cursorPosition.line + 1);
        
        setValue([...linesBefore, lineStart, lineEnd, ...linesAfter].join('\n'));
        setCursorPosition({ line: cursorPosition.line + 1, col: 0 });
      } else {
        // Submit
        onSubmit?.(value);
        setValue('');
        setCursorPosition({ line: 0, col: 0 });
      }
      return;
    }

    if (key.upArrow) {
      if (cursorPosition.line > 0) {
        const nextLine = cursorPosition.line - 1;
        const nextCol = Math.min(cursorPosition.col, lines[nextLine].length);
        setCursorPosition({ line: nextLine, col: nextCol });
      }
      return;
    }

    if (key.downArrow) {
      if (cursorPosition.line < lines.length - 1) {
        const nextLine = cursorPosition.line + 1;
        const nextCol = Math.min(cursorPosition.col, lines[nextLine].length);
        setCursorPosition({ line: nextLine, col: nextCol });
      }
      return;
    }

    if (key.leftArrow) {
      if (cursorPosition.col > 0) {
        setCursorPosition({ ...cursorPosition, col: cursorPosition.col - 1 });
      } else if (cursorPosition.line > 0) {
        const prevLine = cursorPosition.line - 1;
        setCursorPosition({ line: prevLine, col: lines[prevLine].length });
      }
      return;
    }

    if (key.rightArrow) {
      if (cursorPosition.col < lines[cursorPosition.line].length) {
        setCursorPosition({ ...cursorPosition, col: cursorPosition.col + 1 });
      } else if (cursorPosition.line < lines.length - 1) {
        setCursorPosition({ line: cursorPosition.line + 1, col: 0 });
      }
      return;
    }

    if (key.backspace) {
      if (cursorPosition.col > 0) {
        // Delete character on current line
        const currentLine = lines[cursorPosition.line];
        const newLine = currentLine.slice(0, cursorPosition.col - 1) + currentLine.slice(cursorPosition.col);
        const newLines = [...lines];
        newLines[cursorPosition.line] = newLine;
        setValue(newLines.join('\n'));
        setCursorPosition({ ...cursorPosition, col: cursorPosition.col - 1 });
      } else if (cursorPosition.line > 0) {
        // Merge with previous line
        const prevLine = lines[cursorPosition.line - 1];
        const currentLine = lines[cursorPosition.line];
        const newCol = prevLine.length;
        const newLines = [
          ...lines.slice(0, cursorPosition.line - 1),
          prevLine + currentLine,
          ...lines.slice(cursorPosition.line + 1)
        ];
        setValue(newLines.join('\n'));
        setCursorPosition({ line: cursorPosition.line - 1, col: newCol });
      }
      return;
    }

    if (input) {
      const currentLine = lines[cursorPosition.line];
      const newLine = currentLine.slice(0, cursorPosition.col) + input + currentLine.slice(cursorPosition.col);
      const newLines = [...lines];
      newLines[cursorPosition.line] = newLine;
      setValue(newLines.join('\n'));
      setCursorPosition({ ...cursorPosition, col: cursorPosition.col + input.length });
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
            renderedLine = line || ' '; // Ensure empty lines render their height
          }

          return <Text key={lineIdx}>{renderedLine}</Text>;
        })
      )}
    </Box>
  );
}
