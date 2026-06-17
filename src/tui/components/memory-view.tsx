import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface MemoryPartition {
  id: string;
  title: string;
  description: string;
  size: number;
}

interface MemoryViewProps {
  partitions: MemoryPartition[];
  onClose: () => void;
  onFlushPartition: (id: string) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({ partitions, onClose, onFlushPartition }) => {
  const [cursorIndex, setCursorIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }

    if (key.upArrow) {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    
    if (key.downArrow) {
      setCursorIndex(prev => Math.min(partitions.length - 1, prev + 1));
    }

    if (key.backspace || key.delete) {
      onFlushPartition(partitions[cursorIndex].id);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1} marginTop={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="magenta">🧠 Memory Partition Visualizer</Text>
        <Text color="gray">Navigate: [↑/↓] | Flush: [Backspace] | Close: [Esc/q]</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray" italic>
          Manage the agent's long-term and working memory state. Flushing a partition will clear its context but keep the underlying rules intact.
        </Text>
      </Box>

      <Box flexDirection="column">
        {partitions.map((partition, idx) => {
          const isCursor = idx === cursorIndex;
          
          return (
            <Box key={partition.id} paddingY={1} flexDirection="row">
              <Box width={3}>
                <Text color={isCursor ? "cyan" : "gray"}>
                  {isCursor ? "❯ " : "  "}
                </Text>
              </Box>
              <Box flexDirection="column" flexGrow={1}>
                <Box justifyContent="space-between">
                  <Text color={isCursor ? "white" : "gray"} bold>{partition.title}</Text>
                  <Text color="yellow">{Math.round(partition.size / 1024)} KB</Text>
                </Box>
                <Text color="gray" dimColor>{partition.description}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
