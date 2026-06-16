import fs from 'fs';
import path from 'path';
import { log } from '../logger.js';
import { MissionPlanner } from './mission-planner.js';
import { TaskExecutor } from './task-executor.js';
import { Scheduler } from './scheduler.js';
import { listDirTool, readFileTool, writeFileTool, globTool, fileOutlineTool, readLinesTool } from '../tools/file-tools.js';
import { shellTool } from '../tools/shell-tool.js';
import { editFileTool } from '../tools/file-edit.js';
import { searchSymbolsTool } from '../tools/index-tools.js';
import { config } from '../config.js';
import { ExecutionEvent } from './types.js';

export function startWatchDaemon(workspaceRoot: string) {
  log(`[TRIGGER WATCHER] Starting autonomous file watch trigger on: ${workspaceRoot}`, 'INFO');
  console.log(`🌌 Vibes Watch Daemon active. Monitoring workspace changes in: ${workspaceRoot}...`);
  
  const srcDir = path.join(workspaceRoot, 'src');
  const targetDir = fs.existsSync(srcDir) ? srcDir : workspaceRoot;

  let debounceTimeout: NodeJS.Timeout | null = null;
  let isExecuting = false;

  fs.watch(targetDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (
      filename.includes('node_modules') ||
      filename.includes('.git') ||
      filename.includes('.vibes') ||
      filename.includes('dist') ||
      filename.includes('.gemini')
    ) return;

    log(`[TRIGGER] Change detected in: ${filename} (${eventType})`, 'DEBUG');

    if (isExecuting) {
      log(`[TRIGGER] Task execution in progress; change trigger ignored.`, 'DEBUG');
      return;
    }

    if (debounceTimeout) clearTimeout(debounceTimeout);

    debounceTimeout = setTimeout(async () => {
      isExecuting = true;
      log(`[TRIGGER] Change stabilized for: ${filename}. Initiating autonomous review loop...`, 'INFO');
      console.log(`\n⚡ Trigger Fired! Change detected in ${filename}. Running autonomous review loop...`);

      try {
        const description = `File changed: ${filename}. Verify that the code compiles, has correct imports, has no syntax errors, and builds without failure.`;
        
        const planner = new MissionPlanner();
        const plan = await planner.planMission(description, workspaceRoot);

        log(`[TRIGGER] Mission planned: ${plan.title}`, 'INFO');
        console.log(`Planned Mission: ${plan.title}`);

        const tools = [
          listDirTool,
          readFileTool,
          writeFileTool,
          editFileTool,
          globTool,
          shellTool,
          fileOutlineTool,
          readLinesTool,
          searchSymbolsTool
        ];

        const executor = new TaskExecutor(tools, {
          getYoloMode: () => config.YOLO_MODE
        });

        const onEvent = (event: ExecutionEvent) => {
          if (event.type === 'thinking') {
            console.log(` 🤔 Thinking: ${event.content.slice(0, 80)}...`);
          } else if (event.type === 'tool_call') {
            console.log(` 🛠️  Calling Tool: ${event.tool} with args ${JSON.stringify(event.args)}`);
          } else if (event.type === 'task_completed') {
            console.log(` ✅ Task Completed: ${event.title}`);
          } else if (event.type === 'task_failed') {
            console.log(` ❌ Task Failed: ${event.title} - ${event.error}`);
          }
        };

        const scheduler = new Scheduler(plan, executor, onEvent, () => config.YOLO_MODE);
        const completedMission = await scheduler.run();

        log(`[TRIGGER] Autonomous loop completed with status: ${completedMission.status}`, 'INFO');
        console.log(`🏁 Autonomous loop finished. Status: ${completedMission.status}`);
      } catch (err: any) {
        log(`[TRIGGER] Trigger execution failed: ${err.message}`, 'ERROR');
        console.error(`❌ Autonomous loop failed: ${err.message}`);
      } finally {
        isExecuting = false;
      }
    }, 3000);
  });
}
