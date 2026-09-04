import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ToolApprovalViewProps {
  tool: string;
  reason: string;
  preview: string;
  onResolve: (approved: boolean) => void;
}

const OPTIONS: { approved: boolean; label: string; color: string }[] = [
  { approved: true, label: 'Approve — run this tool call', color: 'green' },
  { approved: false, label: 'Deny — block it and tell the agent why', color: 'red' },
];

export const ToolApprovalView: React.FC<ToolApprovalViewProps> = ({ tool, reason, preview, onResolve }) => {
  // Default to Deny: holding Enter through a prompt should never be what approves
  // a mutation the policy already decided it could not allow on its own.
  const [selectedIdx, setSelectedIdx] = useState(1);

  useInput((input, key) => {
    if (key.leftArrow || key.upArrow) {
      setSelectedIdx(prev => (prev - 1 + OPTIONS.length) % OPTIONS.length);
    }
    if (key.rightArrow || key.downArrow) {
      setSelectedIdx(prev => (prev + 1) % OPTIONS.length);
    }
    if (key.return) {
      onResolve(OPTIONS[selectedIdx].approved);
    }
    if (key.escape) {
      onResolve(false);
    }
    if (input === 'y' || input === 'Y') onResolve(true);
    if (input === 'n' || input === 'N') onResolve(false);
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="bold" borderColor="cyan">
      <Box paddingBottom={1}>
        <Text bold color="cyan">🔐 TOOL APPROVAL REQUIRED</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="white">Tool: </Text>
        <Text bold color="yellow">{tool}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">{reason}</Text>
      </Box>

      <Box padding={1} borderStyle="single" borderColor="blue" marginBottom={1} flexDirection="column">
        <Text color="white" bold>Arguments</Text>
        <Box marginTop={1}>
          <Text color="blue" wrap="wrap">{preview}</Text>
        </Box>
      </Box>

      <Box flexDirection="column">
        {OPTIONS.map((opt, idx) => (
          <Box key={opt.label}>
            <Text color={selectedIdx === idx ? opt.color : 'gray'}>
              {selectedIdx === idx ? ' ◉ ' : ' ○ '}
              {opt.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Arrow keys to select, </Text>
        <Text color="white" bold>Enter</Text>
        <Text color="gray"> to confirm — or press </Text>
        <Text color="green" bold>y</Text>
        <Text color="gray"> / </Text>
        <Text color="red" bold>n</Text>
        <Text color="gray"> directly. Esc denies.</Text>
      </Box>
    </Box>
  );
};
