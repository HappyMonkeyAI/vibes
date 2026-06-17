import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Mission } from '../../agent/types.js';
import { MultilineTextInput } from './multiline-text-input.js';

interface WorkspaceProps {
  mission: Mission | null;
  isPlanning: boolean;
  isExecuting: boolean;
  isYoloMode?: boolean;
  onSubmitPrompt: (text: string) => void;
  chatHistory: Array<{ role: 'user' | 'agent', text: string }>;
}

export const Workspace: React.FC<WorkspaceProps> = ({ 
  mission, 
  isPlanning, 
  isExecuting, 
  isYoloMode,
  onSubmitPrompt,
  chatHistory 
}) => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (isExecuting || isPlanning) {
        setDots(prev => (prev === '...' ? '' : prev + '.'));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isExecuting, isPlanning]);

  const allTasks = mission?.milestones.flatMap(m => m.tasks) || [];
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress');

  return (
    <Box flexDirection="row" borderStyle="single" borderColor="cyan" flexGrow={1} height="100%">
      {/* Left Pane: Conversation Stream (70%) */}
      <Box flexDirection="column" width="70%" paddingRight={1} paddingLeft={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">💬 Conversation Stream</Text>
        </Box>
        
        {/* Chat History Area (Scrollable in a real term, simplified here) */}
        <Box flexGrow={1} flexDirection="column" justifyContent="flex-end" overflowY="hidden">
          {chatHistory.length === 0 ? (
            <Text color="gray" italic>Enter a mission description to begin.</Text>
          ) : (
            chatHistory.slice(-5).map((msg, idx) => (
              <Box key={idx} flexDirection="column" marginBottom={1}>
                <Text bold color={msg.role === 'user' ? 'green' : 'blue'}>
                  {msg.role === 'user' ? 'You' : 'Agent'}
                </Text>
                <Text>{msg.text}</Text>
              </Box>
            ))
          )}
        </Box>

        {/* Input Area */}
        <Box paddingTop={1} flexDirection="column">
          <MultilineTextInput
            placeholder="Type your message... (Alt+Enter or Shift+Enter for newline, Enter to submit)"
            onSubmit={onSubmitPrompt}
          />
        </Box>
      </Box>

      {/* Right Pane: Task & Minion Tracking (30%) */}
      <Box flexDirection="column" width="30%" paddingLeft={1}>
        <Box marginBottom={1} justifyContent="space-between">
          <Text bold color="magenta">📋 Active Tasks</Text>
          {isYoloMode && <Text color="red" bold>[YOLO]</Text>}
        </Box>

        {mission ? (
          <Box flexDirection="column">
            <Text color="white" bold>{mission.title}</Text>
            <Box marginY={1} flexDirection="column">
              {allTasks.slice(0, 8).map(task => (
                <Box key={task.id}>
                  <Text color={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'yellow' : task.status === 'failed' ? 'red' : 'gray'}>
                    {task.status === 'done' ? '✔ ' : task.status === 'in_progress' ? '⏳ ' : task.status === 'failed' ? '✖ ' : '· '}
                  </Text>
                  <Text color="white">{task.title}</Text>
                </Box>
              ))}
              {allTasks.length > 8 && <Text color="gray">... and {allTasks.length - 8} more</Text>}
            </Box>
          </Box>
        ) : (
          <Text color="gray">No active mission</Text>
        )}

        <Box flexGrow={1} flexDirection="column" justifyContent="flex-end" paddingTop={1}>
          <Text bold color="cyan">Background Minions</Text>
          {inProgressTasks.length > 0 ? (
            inProgressTasks.map((t, idx) => (
              <Text key={t.id} color="yellow">Worker {idx + 1}: {t.type}</Text>
            ))
          ) : (
            <Text color="gray">None</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};
