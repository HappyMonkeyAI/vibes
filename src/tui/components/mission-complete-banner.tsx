import React from 'react';
import { Box, Text } from 'ink';
import { Mission } from '../../agent/types.js';

export type MissionOutcome =
  | { kind: 'success'; completed: number; total: number }
  | { kind: 'failed'; completed: number; failed: number; total: number };

export function getMissionOutcome(
  mission: Mission | null,
  isExecuting: boolean,
  isPlanning: boolean,
): MissionOutcome | null {
  if (!mission || isExecuting || isPlanning) return null;

  const allTasks = mission.milestones.flatMap((m) => m.tasks);
  const completed = allTasks.filter((t) => t.status === 'done').length;
  const failed = allTasks.filter((t) => t.status === 'failed').length;
  const total = allTasks.length;

  if (mission.status === 'completed') {
    return { kind: 'success', completed, total };
  }

  if (mission.status === 'failed') {
    return { kind: 'failed', completed, failed, total };
  }

  if (total > 0 && completed + failed === total) {
    return failed > 0
      ? { kind: 'failed', completed, failed, total }
      : { kind: 'success', completed, total };
  }

  return null;
}

interface MissionCompleteBannerProps {
  outcome: MissionOutcome;
}

export const MissionCompleteBanner: React.FC<MissionCompleteBannerProps> = ({ outcome }) => {
  const isSuccess = outcome.kind === 'success';

  return (
    <Box
      justifyContent="center"
      borderStyle="single"
      borderColor={isSuccess ? 'green' : 'yellow'}
      paddingX={1}
      marginTop={1}
      flexDirection="column"
    >
      <Box justifyContent="center">
        <Text color={isSuccess ? 'green' : 'yellow'} bold inverse>
          {isSuccess
            ? ` ✅ MISSION COMPLETED SUCCESSFULLY (${outcome.completed}/${outcome.total} tasks) `
            : ` ⚠ MISSION FINISHED WITH FAILURES (${outcome.completed}/${outcome.total} done${outcome.failed > 0 ? `, ${outcome.failed} failed` : ''}) `}
        </Text>
      </Box>
      <Box justifyContent="center" marginTop={1}>
        <Text color="gray">Press </Text>
        <Text color="cyan" bold>Alt+N</Text>
        <Text color="gray"> for a new mission, </Text>
        <Text color="cyan" bold>Alt+M</Text>
        <Text color="gray"> to review details, or </Text>
        <Text color="cyan" bold>Alt+R</Text>
        <Text color="gray"> to inspect changes.</Text>
      </Box>
    </Box>
  );
};