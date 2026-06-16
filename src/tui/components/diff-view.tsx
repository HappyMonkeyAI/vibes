import React from 'react';
import { Box, Text } from 'ink';
import { execSync } from 'child_process';
import { Mission } from '../../agent/types.js';

interface DiffViewProps {
  mission: Mission;
}

export const DiffView: React.FC<DiffViewProps> = React.memo(({ mission }) => {
  // Find all active or completed tasks
  const activeTasks = mission.milestones
    .flatMap(m => m.tasks)
    .filter(t => t.status === 'done' || t.status === 'in_progress');

  if (activeTasks.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="gray">No active or completed tasks to review yet.</Text>
      </Box>
    );
  }

  // Fetch current git diff in the workspace
  let diffContent = '';
  try {
    diffContent = execSync('git diff HEAD', { cwd: mission.workspace_root }).toString();
  } catch (err: any) {
    diffContent = `Failed to get git diff: ${err.message}`;
  }

  if (!diffContent.trim()) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" gap={1}>
        <Text bold color="cyan">Code Review & Diff Viewer</Text>
        <Text color="green">✔ No edits detected. Git working tree is clean.</Text>
      </Box>
    );
  }

  const lines = diffContent.split('\n');
  let currentFile = '';
  let newLineNum = 0;

  // Aggregate issues
  const auditIssues = activeTasks.flatMap(t => t.auditIssues || []);
  const reviewIssues = activeTasks.flatMap(t => t.reviewIssues || []);

  const renderedDiff: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file headers
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      currentFile = match ? match[1] : '';
      renderedDiff.push(
        <Box key={`file-${i}`} marginTop={1}>
          <Text bold color="yellow">📄 File: {currentFile}</Text>
        </Box>
      );
      continue;
    }

    // Detect chunk boundaries
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      newLineNum = match ? parseInt(match[1], 10) - 1 : 0;
      renderedDiff.push(
        <Text key={`chunk-${i}`} color="cyan">{line}</Text>
      );
      continue;
    }

    // Process line changes
    if (line.startsWith('+')) {
      newLineNum++;
      renderedDiff.push(
        <Text key={`line-${i}`} color="green">{line}</Text>
      );

      // Align static lints or reviewer issues
      const lineAudit = auditIssues.filter(issue => issue.file === currentFile && issue.message.includes(`line ${newLineNum}`));
      const lineReview = reviewIssues.filter(issue => issue.file === currentFile && issue.line === newLineNum);

      lineAudit.forEach((issue, idx) => {
        renderedDiff.push(
          <Box key={`audit-warn-${i}-${idx}`} paddingLeft={2}>
            <Text bold color="red">  ⚠ [Structural Audit] {issue.message}</Text>
          </Box>
        );
      });

      lineReview.forEach((issue, idx) => {
        renderedDiff.push(
          <Box key={`review-warn-${i}-${idx}`} paddingLeft={2} flexDirection="column">
            <Text bold color={issue.severity === 'error' ? 'red' : 'yellow'}>
              {"  "}✖ [{issue.severity.toUpperCase()}] {issue.comment}
            </Text>
            {issue.suggestion && (
              <Text color="gray" dimColor>    Suggestion: {issue.suggestion}</Text>
            )}
          </Box>
        );
      });

    } else if (line.startsWith('-')) {
      renderedDiff.push(
        <Text key={`line-${i}`} color="red">{line}</Text>
      );
    } else {
      // Unchanged code lines
      if (!line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++')) {
        newLineNum++;
        renderedDiff.push(
          <Text key={`line-${i}`} color="gray">{line}</Text>
        );
      }
    }
  }

  // To prevent the terminal from overflowing, we render the last 30 lines of the diff view
  const displayLines = renderedDiff.slice(-30);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" minHeight={15}>
      <Box justifyContent="space-between" paddingBottom={1}>
        <Text bold color="cyan">Code Review & Diff Panel</Text>
        <Text color="gray" dimColor>Shows local task diff with inline warnings</Text>
      </Box>
      <Box flexDirection="column">
        {displayLines}
      </Box>
    </Box>
  );
});
