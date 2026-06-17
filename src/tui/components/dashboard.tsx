import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Mission, Task } from '../../agent/types.js';
import os from 'os';

interface DashboardProps {
  mission: Mission | null;
  isPlanning: boolean;
  isExecuting: boolean;
  isYoloMode?: boolean;
  contextUsage?: { used: number; total: number; percentage: number } | null;
  triageState?: { state: 'watching' | 'guiding' | 'escalated'; message?: string } | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ mission, isPlanning, isExecuting, isYoloMode, contextUsage, triageState }) => {
  const [dots, setDots] = useState('');
  const [systemInfo, setSystemInfo] = useState({
    cpu: 0,
    mem: 0,
    freeMem: 0,
    totalMem: 0,
  });

  // Heartbeat animation and system info refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (isExecuting || isPlanning) {
        setDots(prev => (prev === '...' ? '' : prev + '.'));
      }

      // Update system info
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPct = Math.round((usedMem / totalMem) * 100);
      
      // Simple load avg for CPU proxy
      const load = os.loadavg()[0];
      const cpuPct = Math.min(Math.round((load / os.cpus().length) * 100), 100);

      setSystemInfo({
        cpu: cpuPct,
        mem: memPct,
        freeMem: Math.round(freeMem / (1024 * 1024 * 1024) * 10) / 10,
        totalMem: Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExecuting, isPlanning]);

  if (!mission) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan">
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">🛸 Vibes Mission Control (Wayland Mode)</Text>
        </Box>
        {isPlanning ? (
          <Text color="yellow">Planning mission{dots} Analyzing goals and breaking down tasks.</Text>
        ) : (
          <Box flexDirection="column" alignItems="center">
            <Text color="gray">Ready for dispatch. Enter a mission description to begin.</Text>
          </Box>
        )}
      </Box>
    );
  }

  const allTasks = mission.milestones.flatMap(m => m.tasks);
  const completed = allTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress');
  const failed = allTasks.filter(t => t.status === 'failed').length;
  const total = allTasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const isFinished = !isExecuting && (completed + failed === total);

  const getContextColor = (pct: number): string => {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'yellow';
    return 'green';
  };

  return (
    <Box flexDirection="row" borderStyle="single" borderColor={isFinished ? (failed > 0 ? 'yellow' : 'green') : 'cyan'}>
      {/* Left Pane: Primary Mission View */}
      <Box flexDirection="column" width="50%" padding={1} >
        <Box justifyContent="space-between">
          <Text bold color="white">{mission.title}</Text>
          {isYoloMode && <Text color="red" bold> [YOLO]</Text>}
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
            <Text color="yellow">{inProgressTasks.length > 0 ? inProgressTasks.length : ''}</Text>
            {failed > 0 && <Text color="red">/{failed}✗</Text>}
            <Text>/{total}</Text>
          </Box>
        </Box>

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
                ~{Math.round(contextUsage.used / 1000)}K/{Math.round(contextUsage.total / 1000)}K ({contextUsage.percentage}%)
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Right Pane: Background Minions (Wayland Top) */}
      <Box flexDirection="column" width="50%" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="magenta">Minion Threads</Text>
          {isExecuting && <Text color="yellow"> {dots}</Text>}
        </Box>
        
        {inProgressTasks.length > 0 ? (
          inProgressTasks.map((task, idx) => (
            <Box key={task.id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="yellow">► </Text>
                <Text color="white" bold>Worker {idx + 1}: </Text>
                <Text color="gray">{task.type.toUpperCase()}</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color="cyan">{task.title}</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text dimColor color="gray">Target: {task.files.length > 0 ? task.files[0] : 'workspace'}</Text>
              </Box>
            </Box>
          ))
        ) : (
          <Box paddingLeft={2} paddingTop={1}>
            <Text color="gray" dimColor>No active minion threads.</Text>
          </Box>
        )}

        <Box flexGrow={1} flexDirection="column" justifyContent="flex-end" paddingTop={1}>
          <Box gap={2}>
            <Box>
              <Text>CPU: </Text>
              <Text color={systemInfo.cpu > 80 ? 'red' : systemInfo.cpu > 50 ? 'yellow' : 'green'}>{systemInfo.cpu}%</Text>
            </Box>
            <Box>
              <Text>MEM: </Text>
              <Text color={systemInfo.mem > 90 ? 'red' : systemInfo.mem > 70 ? 'yellow' : 'green'}>{systemInfo.mem}%</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
