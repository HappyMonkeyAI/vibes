#!/usr/bin/env node

import React from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { EnhancedTextInput } from './tui/components/enhanced-text-input.js';
import { useMission } from './tui/hooks/use-mission.js';
import { useUpdateCheck } from './tui/hooks/use-update-check.js';
import { useSettings } from './tui/hooks/use-settings.js';
import { Workspace } from './tui/components/workspace.js';
import { MissionView } from './tui/components/mission-view.js';
import { TaskView } from './tui/components/task-view.js';
import { TraceView } from './tui/components/trace-view.js';
import { SettingsView } from './tui/components/settings-view.js';
import { ApprovalView } from './tui/components/approval-view.js';
import { InterventionView } from './tui/components/intervention-view.js';
import { LogStreamView } from './tui/components/log-stream-view.js';
import { UpdateNotification } from './tui/components/update-notification.js';
import { DiffView } from './tui/components/diff-view.js';
import { MemoryView, MemoryPartition } from './tui/components/memory-view.js';
import { initLogger } from './logger.js';
import { hasPersistentConfig } from './config.js';
import path from 'path';

const App = () => {
  const {
    mission, pendingMission, isPlanning, isExecuting,
    error, events, contextUsage, pendingIntervention, activeMaxSteps,
    isYoloMode, toggleYoloMode, sessions, triageState, governorStats,
    startMission, approveMission, rejectMission, resolveIntervention, resetMission, undoMission,
    loadSession, deleteSession,
  } = useMission();

  const { exit } = useApp();
  const {
    updateInfo, status: updateStatus, error: updateError,
    dismissed: updateDismissed, updateLog,
    performUpdate, dismiss: dismissUpdate, resetStatus: resetUpdateStatus,
  } = useUpdateCheck();

  const { 
    settings, 
    saveSettings 
  } = useSettings();
  const closeSettings = React.useCallback(() => setView('dashboard'), []);

  const [workspace, setWorkspace] = React.useState(process.env.VIBES_LAUNCH_DIR || process.cwd());
  const [view, setView] = React.useState<'dashboard' | 'mission' | 'task' | 'trace' | 'settings' | 'history' | 'log' | 'review' | 'memory'>(
    hasPersistentConfig() ? 'dashboard' : 'settings'
  );
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [isCodexEnabled, setIsCodexEnabled] = React.useState(settings.CODEX_ENABLED);

  const isIdle = !mission && !isPlanning && !pendingMission;

  // Mock Memory Partitions for ADR 0005 scaffolding
  const [memoryPartitions, setMemoryPartitions] = React.useState<MemoryPartition[]>([
    { id: 'working', title: 'Working Memory', description: 'Active context for current tasks (checkpoint.md)', size: 45000 },
    { id: 'episodic', title: 'Episodic Memory', description: 'Recent experiences and tool executions (progress.md)', size: 120000 },
    { id: 'semantic', title: 'Semantic Memory', description: 'Workspace rules, constraints, and architecture guidelines (MEMORY.md)', size: 34000 },
    { id: 'lessons', title: 'Evolution Lessons', description: 'Trace-driven prompt corrections (evolution_rules.md)', size: 8500 },
  ]);

  const handleFlushPartition = (id: string) => {
    // In a real implementation, this would call memory-service.ts to wipe the file
    setMemoryPartitions(prev => prev.map(p => p.id === id ? { ...p, size: 0 } : p));
  };

  // Mock chat history for ADR 0006
  const [chatHistory, setChatHistory] = React.useState<Array<{ role: 'user' | 'agent', text: string }>>([
    { role: 'agent', text: 'Welcome to Vibes TUI 2.0. How can I assist you today?' }
  ]);

  const handleSubmitPrompt = (text: string) => {
    if (!text.trim()) return;
    setChatHistory(prev => [...prev, { role: 'user', text }]);
    // In a real implementation, this would call startMission or continueMission
    if (!mission && !pendingMission && !isExecuting) {
      startMission(text, workspace);
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'q') exit();
    if (key.meta && input === 'm') {
      setView(prev => prev === 'memory' ? 'dashboard' : 'memory');
      return;
    }
    if (key.meta && input === 'c') {
      const newVal = !isCodexEnabled;
      setIsCodexEnabled(newVal);
      saveSettings({ CODEX_ENABLED: newVal });
      return;
    }

    // Update notification keys (priority, use Alt to avoid typing conflict)
    if (key.meta && input === 'u' && updateInfo?.available && !updateDismissed && updateStatus === 'idle') {
      performUpdate();
      return;
    }
    if (key.meta && input === 'x' && updateInfo?.available && !updateDismissed) {
      dismissUpdate();
      return;
    }

    // Suppress nav/toggle keys while modal views or update process are active
    if (pendingMission || pendingIntervention || updateStatus === 'updating') return;

    // Handle global system navigation shortcuts (meta/Alt keys) first to prevent input leakage
    if (key.meta) {
      if (input === 'd') { setView('dashboard'); return; }
      if (input === 'm') { setView('mission'); return; }
      if (input === 't') { setView('trace'); return; }
      if (key.shift && input === 't') { setView('task'); return; }
      if (input === 's') { setView(prev => prev === 'settings' ? 'dashboard' : 'settings'); return; }
      if (input === 'h') { setView(prev => prev === 'history' ? 'dashboard' : 'history'); return; }
      if (input === 'l') { setView(prev => prev === 'log' ? 'dashboard' : 'log'); return; }
      if (input === 'r') { setView(prev => prev === 'review' ? 'dashboard' : 'review'); return; }
      if (input === 'y') { toggleYoloMode(); return; }
      if (input === 'n') {
        resetMission();
        setView('dashboard');
        setFocusIndex(1);
        return;
      }
      if (input === 'z') {
        undoMission();
        setView('dashboard');
        return;
      }
    }

    // Settings owns its full keyboard interaction model.
    if (view === 'settings') return;

    // Suppress other global shortcuts while typing in dashboard text fields.
    if (isIdle && view === 'dashboard') {
      if (key.tab && !key.shift) setFocusIndex(prev => (prev === 0 ? 1 : 0));
      if (key.tab && key.shift) setFocusIndex(prev => (prev === 1 ? 0 : 1));
      return;
    }

    // Home/End key navigation (only when not typing in text fields or scrolling logs)
    const canUseHomeEndForNav = !isIdle && view !== 'log' && view !== 'trace';
    if (canUseHomeEndForNav) {
      if (key.home) { setView('dashboard'); return; }
      if (key.end) { setView('log'); return; }
    }

    if (view === 'history') {
      if (key.upArrow) setFocusIndex(prev => Math.max(2, prev - 1));
      if (key.downArrow) setFocusIndex(prev => Math.min(sessions.length + 1, prev + 1));
      if (key.return) {
        const session = sessions[focusIndex - 2];
        if (session) {
          loadSession(session);
          setView('mission');
        }
      }
      if (key.delete || key.backspace) {
        const session = sessions[focusIndex - 2];
        if (session) deleteSession(session.mission.id);
      }
      return;
    }
  });



  const handleSubmit = (val: string) => {
    if (val.trim()) {
      const absolutePath = path.isAbsolute(workspace)
        ? workspace
        : path.resolve(process.cwd(), workspace);
      startMission(val, absolutePath);
    }
  };

  const contextKB = Math.round(settings.CONTEXT_WINDOW / 1024);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" borderStyle="round" borderColor="blue" paddingX={1}>
        <Text bold color="cyan">VIBES TUI</Text>
        <Box gap={2}>
          {!pendingMission && !pendingIntervention && !isIdle && (
            <>
              <Text color="green">[Alt+N] New</Text>
              <Text color="red">[Alt+Z] Undo</Text>
              <Text color={isCodexEnabled ? 'green' : 'gray'}>[Alt+C] Codex</Text>
              <Text color={isYoloMode ? 'yellow' : 'blue'} bold={isYoloMode}>[Alt+Y] YOLO</Text>
            </>
          )}
          <Text color="red">[Ctrl+Q] Quit</Text>
        </Box>
      </Box>

      {isYoloMode && view !== 'settings' && (
        <Box justifyContent="center" borderStyle="single" borderColor="yellow" paddingX={1} marginTop={1}>
          <Text color="yellow" bold inverse> ⚡ YOLO MODE ENABLED — NO STEP LIMITS ⚡ </Text>
        </Box>
      )}

      {/* Update Notification */}
      {view !== 'settings' && (
        <UpdateNotification
          updateInfo={updateInfo}
          status={updateStatus}
          error={updateError}
          dismissed={updateDismissed}
          updateLog={updateLog}
          onUpdate={performUpdate}
          onDismiss={dismissUpdate}
          onReset={resetUpdateStatus}
        />
      )}

      {/* Main Content */}
      <Box flexDirection="column" minHeight={15} marginTop={1}>
        {error && view !== 'settings' && (
          <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1} flexDirection="column">
            <Text color="red" bold>Error Detected:</Text>
            <Text color="red">{error.length > 500 ? error.slice(0, 500) + '...' : error}</Text>
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                {error.toLowerCase().includes('speculative decoding')
                  ? 'This is a model-server capability mismatch, not malformed model output.'
                  : 'The model may have produced malformed output. Try a more specific description.'}
              </Text>
            </Box>
          </Box>
        )}

        {/* Modals — rendered in place of everything else */}
        {pendingMission && (
          <ApprovalView
            mission={pendingMission}
            onApprove={approveMission}
            onReject={rejectMission}
          />
        )}

        {pendingIntervention && (
          <InterventionView
            taskId={pendingIntervention.taskId}
            error={pendingIntervention.error}
            question={pendingIntervention.question}
            onResolve={resolveIntervention}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            settings={settings}
            onSave={saveSettings}
            onClose={closeSettings}
          />
        )}

        {view === 'memory' && (
          <MemoryView
            partitions={memoryPartitions}
            onClose={() => setView('dashboard')}
            onFlushPartition={handleFlushPartition}
          />
        )}

        {!pendingMission && !pendingIntervention && view === 'dashboard' && (
          <Workspace
            mission={mission}
            isPlanning={isPlanning}
            isExecuting={isExecuting}
            isYoloMode={isYoloMode}
            onSubmitPrompt={handleSubmitPrompt}
            chatHistory={chatHistory}
          />
        )}

        {!pendingMission && !pendingIntervention && view === 'mission' && mission && (
          <MissionView mission={mission} />
        )}

        {!pendingMission && !pendingIntervention && view === 'task' && (
          <TaskView events={events} isExecuting={isExecuting} />
        )}
        
        {!pendingMission && !pendingIntervention && view === 'log' && (
          <LogStreamView events={events} />
        )}

        {!pendingMission && !pendingIntervention && view === 'trace' && (
          <TraceView events={events} />
        )}

        {!pendingMission && !pendingIntervention && view === 'review' && mission && (
          <DiffView mission={mission} />
        )}

        {view === 'history' && (
          <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
            <Text bold color="magenta">Mission History</Text>
            {sessions.length === 0 ? (
              <Text color="gray">No past sessions found.</Text>
            ) : (
              <Box flexDirection="column" marginTop={1}>
                {sessions.map((session, idx) => (
                  <Box key={session.mission.id} justifyContent="space-between">
                    <Box>
                      <Text color={focusIndex === idx + 2 ? 'cyan' : 'white'}>
                        {focusIndex === idx + 2 ? '▶ ' : '  '}
                        {session.mission.title}
                      </Text>
                      <Text color="gray"> ({session.mission.status})</Text>
                    </Box>
                    <Text color="gray" dimColor>{new Date(session.updatedAt).toLocaleString()}</Text>
                  </Box>
                ))}
                <Box marginTop={1}>
                  <Text color="gray">Use </Text>
                  <Text color="cyan" bold>Enter</Text>
                  <Text color="gray"> to load, </Text>
                  <Text color="red" bold>Del</Text>
                  <Text color="gray"> to delete.</Text>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {isIdle && view !== 'settings' && view !== 'dashboard' && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray" italic>Workspace is ready. Use the Dashboard to begin a mission.</Text>
          </Box>
        )}
      </Box>

      {/* Navigation */}
      {!pendingMission && !pendingIntervention && view !== 'settings' && (
        <Box borderStyle="single" borderColor="blue" paddingX={1} justifyContent="center" gap={2} marginTop={1}>
          {!isIdle ? (
            <>
              <Text color={view === 'dashboard' ? 'white' : 'blue'}>[Alt+D] Dash</Text>
              <Text color={view === 'mission' ? 'white' : 'blue'}>[Alt+M] Mission</Text>
              <Text color={view === 'trace' ? 'white' : 'blue'}>[Alt+T] Trace</Text>
              <Text color={view === 'task' ? 'white' : 'blue'}>[Alt+⇧T] Task</Text>
              <Text color={view === 'review' ? 'white' : 'blue'}>[Alt+R] Review</Text>
              <Text color="blue">[Alt+S] Settings</Text>
              <Text color={view === 'log' ? 'white' : 'blue'}>[Alt+L] Logs</Text>
            </>
          ) : (
            <>
              <Text color={view === 'history' ? 'white' : 'blue'}>[Alt+H] History</Text>
              <Text color="blue">[Alt+S] Settings</Text>
            </>
          )}
        </Box>
      )}

      {/* Footer */}
      {view !== 'settings' && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
          <Text color="gray">Model: {settings.OLLAMA_MODEL}</Text>
          <Box gap={1}>
            {governorStats && (
              <Text color="cyan">
                Turns: {governorStats.turnsUsed}/{governorStats.maxTurns} | Tokens: {Math.round(governorStats.tokensUsed / 102) / 10}k/{Math.round(governorStats.maxTokens / 1024)}k |
              </Text>
            )}
            <Text color="gray">
              Context: {contextKB}K tokens | Max Steps:
            </Text>
            <Text color={isYoloMode || activeMaxSteps > settings.MAX_STEPS ? 'yellow' : 'gray'} bold={isYoloMode || activeMaxSteps > settings.MAX_STEPS}>
              {isYoloMode ? '∞' : activeMaxSteps}{!isYoloMode && activeMaxSteps > settings.MAX_STEPS ? ` (+${activeMaxSteps - settings.MAX_STEPS})` : ''}
            </Text>
            <Text color="gray"> | Concurrent: {settings.MAX_CONCURRENT_TASKS}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

process.stdout.write('\x1Bc');
render(<App />);
