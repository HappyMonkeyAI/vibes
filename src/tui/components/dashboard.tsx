import React from 'react';
import { Box, Text } from 'ink';
import { Mission } from '../../agent/types.js';

interface DashboardProps {
  mission: Mission | null;
  isPlanning: boolean;
  isExecuting: boolean;
  contextUsage?: { used: number; total: number; percentage: number } | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ mission, isPlanning, isExecuting, contextUsage }) => {
  if (!mission) {
    return (
      <Box flexDirection="column" padding={1}>
        {isPlanning ? (
          <Text color="yellow">Planning mission... Analyzing goals and breaking down tasks.</Text>
        ) : (
          <Text color="gray">No active mission. Enter a mission description to begin.</Text>
        )}
      </Box>
    );
  }

  const allTasks = mission.milestones.flatMap(m => m.tasks);
  const completed = allTasks.filter(t => t.status === 'done').length;
  const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
  const failed = allTasks.filter(t => t.status === 'failed').length;
  const total = allTasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Context usage color coding
  const getContextColor = (pct: number): string => {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'yellow';
    return 'green';
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan">
      <Box justifyContent="space-between">
        <Text bold color="white">{mission.title}</Text>
        <Text color="blue">{percentage}% Complete</Text>
      </Box>
      <Box paddingBottom={1}>
        <Text color="gray" italic>{mission.description}</Text>
      </Box>
      
      <Box flexDirection="row" gap={2}>
        <Box>
          <Text>Progress: </Text>
          <Text color="green">[{'█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5))}]</Text>
        </Box>
        <Box>
          <Text>Tasks: </Text>
          <Text color="green">{completed}</Text>
          <Text>/</Text>
          <Text color="yellow">{inProgress > 0 ? inProgress : ''}</Text>
          {failed > 0 && <Text color="red">/{failed}✗</Text>}
          <Text>/{total}</Text>
        </Box>
      </Box>

      {/* Context Window Usage */}
      {contextUsage && (
        <Box paddingTop={1} flexDirection="row" gap={2}>
          <Box>
            <Text>Context: </Text>
            <Text color={getContextColor(contextUsage.percentage)}>
              [{'█'.repeat(Math.floor(Math.min(contextUsage.percentage, 100) / 5)) + '░'.repeat(20 - Math.floor(Math.min(contextUsage.percentage, 100) / 5))}]
            </Text>
          </Box>
          <Box>
            <Text color={getContextColor(contextUsage.percentage)}>
              ~{Math.round(contextUsage.used / 1000)}K/{Math.round(contextUsage.total / 1000)}K tokens ({contextUsage.percentage}%)
            </Text>
          </Box>
          {contextUsage.percentage >= 80 && (
            <Text color="red" bold> ⚠ HIGH</Text>
          )}
        </Box>
      )}

      {isExecuting && (
        <Box paddingTop={1}>
          <Text color="yellow">Status: </Text>
          <Text bold color="yellow">EXECUTING AGENT LOOP</Text>
        </Box>
      )}
    </Box>
  );
};
