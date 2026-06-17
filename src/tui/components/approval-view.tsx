import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Mission, Task } from '../../agent/types.js';

interface ApprovalViewProps {
  mission: Mission;
  onApprove: (approvedTaskIds: string[]) => void;
  onReject: () => void;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({ mission, onApprove, onReject }) => {
  // Flatten all tasks to manage selection state easily
  const allTasks = mission.milestones.flatMap(m => m.tasks);
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set(allTasks.map(t => t.id)));
  const [cursorIndex, setCursorIndex] = useState(0);

  // Map 1D cursor index back to milestone/task for rendering
  let currentFlattenedIndex = 0;

  useInput((input, key) => {
    if (key.return || (input === 'y' && key.ctrl)) {
      onApprove(Array.from(selectedTaskIds));
      return;
    }
    
    if (key.escape || (input === 'c' && key.ctrl)) {
      onReject();
      return;
    }

    if (key.upArrow) {
      setCursorIndex(prev => Math.max(0, prev - 1));
    }
    
    if (key.downArrow) {
      setCursorIndex(prev => Math.min(allTasks.length - 1, prev + 1));
    }

    if (input === ' ' || key.rightArrow || key.leftArrow) {
      const activeTaskId = allTasks[cursorIndex].id;
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        if (next.has(activeTaskId)) {
          next.delete(activeTaskId);
        } else {
          next.add(activeTaskId);
        }
        return next;
      });
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} marginTop={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">⚙ Plan-First Checklist (Wayland Mode)</Text>
        <Text color="gray">Toggle: [Space] | Navigate: [↑/↓] | Approve: [Enter]</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color="white">{mission.title}</Text>
      </Box>

      {mission.milestones.map((milestone, mIdx) => (
        <Box key={milestone.id} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color="magenta" bold>{mIdx + 1}. {milestone.title}</Text>
          </Box>
          {milestone.tasks.map((task) => {
            const isCursor = currentFlattenedIndex === cursorIndex;
            const isSelected = selectedTaskIds.has(task.id);
            currentFlattenedIndex++;

            return (
              <Box key={task.id} paddingLeft={2} flexDirection="column">
                <Box>
                  <Text color={isCursor ? "cyan" : "gray"}>
                    {isCursor ? "❯ " : "  "}
                  </Text>
                  <Text color={isSelected ? "green" : "gray"}>
                    [{isSelected ? "x" : " "}] 
                  </Text>
                  <Text color={isSelected ? "white" : "gray"} dimColor={!isSelected}>
                    {' '}{task.title}
                  </Text>
                </Box>
                {task.files.length > 0 && isSelected && (
                  <Box paddingLeft={6}>
                    <Text color="blue" dimColor>→ {task.files.join(', ')}</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      ))}

      <Box borderStyle="single" borderColor="gray" marginTop={1} paddingX={1} justifyContent="space-between">
        <Text color="gray">Selected: <Text color="white">{selectedTaskIds.size}/{allTasks.length}</Text> tasks</Text>
      </Box>

      <Box marginTop={1} gap={4}>
        <Box>
          <Text color="green" bold>[Enter]</Text>
          <Text color="green"> Execute Selected</Text>
        </Box>
        <Box>
          <Text color="red" bold>[Esc]</Text>
          <Text color="red"> Reject Plan</Text>
        </Box>
      </Box>
    </Box>
  );
};
