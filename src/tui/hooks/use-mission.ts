import { useState, useCallback } from 'react';
import { Mission, Task, Milestone, ExecutionEvent } from '../../agent/types.js';
import { MissionPlanner } from '../../agent/mission-planner.js';
import { TaskExecutor } from '../../agent/task-executor.js';
import { Scheduler } from '../../agent/scheduler.js';
import { listDirTool, readFileTool, writeFileTool, globTool } from '../../tools/file-tools.js';
import { shellTool } from '../../tools/shell-tool.js';
import { editFileTool } from '../../tools/file-edit.js';

export const useMission = () => {
  const [mission, setMission] = useState<Mission | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [contextUsage, setContextUsage] = useState<{ used: number; total: number; percentage: number } | null>(null);

  const startMission = useCallback(async (description: string, workspaceRoot: string = process.cwd()) => {
    setIsPlanning(true);
    setError(null);
    setEvents([]);
    setContextUsage(null);
    try {
      const planner = new MissionPlanner();
      const plan = await planner.planMission(description, workspaceRoot);
      setMission(plan);
      setIsPlanning(false);

      // Automatically start execution after planning for now
      setIsExecuting(true);
      const tools = [listDirTool, readFileTool, writeFileTool, editFileTool, globTool, shellTool];
      const executor = new TaskExecutor(tools);
      
      const onEvent = (event: ExecutionEvent) => {
        // Track context usage separately for the dashboard
        if (event.type === 'context_update') {
          setContextUsage({ used: event.used, total: event.total, percentage: event.percentage });
        }
        setEvents(prev => [...prev, event]);
      };

      const scheduler = new Scheduler(plan, executor, onEvent);
      
      const completedMission = await scheduler.run();
      setMission({ ...completedMission });
    } catch (err: any) {
      setError(err.message);
      setIsPlanning(false);
    } finally {
      setIsExecuting(false);
    }
  }, []);

  return {
    mission,
    isPlanning,
    isExecuting,
    error,
    events,
    contextUsage,
    startMission,
  };
};
