import { Mission, Task, OnEvent, TriageAction } from './types.js';
import { TaskExecutor } from './task-executor.js';
import { config } from '../config.js';
import { log } from '../logger.js';
import { InterventionManager } from './intervention-manager.js';
import { getMemoryService } from '../memory/index.js';
import { runStructuralAudit } from './structural-audit.js';
import { createDefaultGoalJudge } from './goal-judge.js';
import { TriageAgent } from './triage-agent.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describeDependencyDeadlock, getExecutionConcurrency } from './scheduler-deps.js';
import { RunRegistry } from './run-registry.js';
import { traceFilePath } from './trace.js';
import { createContextPack, createEvidenceHandoff } from './protocol-contracts.js';
import { evaluateMissionCompletion } from './mission-integrator.js';
import { Reviewer, validateReviewerModelSeparation } from './reviewer.js';
import { getSmallModelRuntimeProfile } from './model-prompts.js';
import { createTaskWorktree, isRepositoryClean, mergeDeclaredTaskFiles, removeTaskWorktree, type TaskWorktree } from './worktree-manager.js';

const execFileAsync = promisify(execFile);

export type InterventionResolution = {
  action: 'retry' | 'skip' | 'fail' | 'reply';
  message?: string;
  retryFromTaskId?: string;
};

export class Scheduler {
  private _mission: Mission;

  /** Read-only public accessor — use-mission.ts needs the current mission state during event flush. */
  get mission(): Mission { return this._mission; }
  get runs(): ReturnType<RunRegistry['list']> { return this.runRegistry.list(); }
  private executor: TaskExecutor;
  private onEvent?: OnEvent;
  private runningTasks: Set<string> = new Set();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();
  private taskMap: Map<string, Task> = new Map();
  private interventionManager = new InterventionManager();
  private runRegistry: RunRegistry;
  private persistState?: (mission: Mission) => Promise<void> | void;

  // Pending intervention: resolve callback waiting for user input
  private interventionResolve: ((res: InterventionResolution) => void) | null = null;
  // Pending tool approval — a separate slot so an approval prompt and a failure
  // intervention can never overwrite one another's resolver.
  private approvalResolve: ((approved: boolean) => void) | null = null;
  private approvalQueue: Promise<void> = Promise.resolve();
  private approvalsAborted = false;
  private getYoloMode: () => boolean;

  triageAgent?: TriageAgent;
  private pendingSteerMessage = '';
  private lastTriageTime = 0;
  private static readonly TRIAGE_WALL_CLOCK_MS = 30000;
  private lastEmittedTriageState: string = '';

  constructor(
    mission: Mission,
    executor: TaskExecutor,
    onEvent?: OnEvent,
    getYoloMode: () => boolean = () => config.YOLO_MODE,
    persistState?: (mission: Mission) => Promise<void> | void,
  ) {
    this._mission = mission;
    this.executor = executor;
    this.onEvent = onEvent;
    this.getYoloMode = getYoloMode;
    this.persistState = persistState;
    const runsPath = join(mission.workspace_root, '.vibes', 'runs', `${mission.id}.json`);
    this.runRegistry = new RunRegistry({ persistPath: runsPath });
    this.restoreRunRoster(runsPath);
    this.rebuildTaskMap();
  }

  /** Recover the previous roster so a resumed mission keeps its earlier attempts. */
  private restoreRunRoster(runsPath: string) {
    try {
      if (!existsSync(runsPath)) return;
      const records = JSON.parse(readFileSync(runsPath, 'utf8'));
      if (!Array.isArray(records)) return;
      this.runRegistry.restore(records);
      // Anything still marked queued or running belongs to a process that is no longer alive.
      this.runRegistry.markInterrupted();
    } catch {
      // A missing or corrupt roster must not stop a mission from starting.
    }
  }

  private rebuildTaskMap() {
    this.taskMap.clear();
    this.completedTasks.clear();
    this.failedTasks.clear();
    for (const milestone of this._mission.milestones) {
      for (const task of milestone.tasks) {
        this.taskMap.set(task.id, task);
        if (task.status === 'done') {
          this.completedTasks.add(task.id);
        } else if (task.status === 'failed') {
          this.failedTasks.add(task.id);
        }
      }
    }
  }

  /**
   * Called externally (from the TUI hook) to resolve a pending intervention.
   */
  public resolveIntervention(resolution: InterventionResolution) {
    if (this.interventionResolve) {
      this.interventionResolve(resolution);
      this.interventionResolve = null;
    }
  }

  /**
   * Suspends the running tool call until the user approves or denies it. This is
   * the `ask` arm of the approval policy — without it `ask` would be
   * indistinguishable from `deny` and no mutation could ever proceed.
   */
  public requestToolApproval(request: { tool: string; reason: string; preview: string }): Promise<boolean> {
    // Serialized: with MAX_CONCURRENT_TASKS > 1 two workers can ask at once, and a
    // second prompt overwriting the resolver would strand the first one forever.
    const answered = this.approvalQueue.then(() => this.promptForApproval(request));
    this.approvalQueue = answered.then(() => undefined, () => undefined);
    return answered;
  }

  private promptForApproval(request: { tool: string; reason: string; preview: string }): Promise<boolean> {
    if (this.approvalsAborted) return Promise.resolve(false);

    const taskId = this.triageAgent?.currentTaskId ?? [...this.runningTasks][0] ?? '';
    const previousStatus = this._mission.status;
    this._mission.status = 'awaiting_intervention';

    return new Promise<boolean>((resolve) => {
      this.approvalResolve = (approved: boolean) => {
        // Only hand the status back if nothing else claimed it while we waited.
        if (this._mission.status === 'awaiting_intervention') {
          this._mission.status = previousStatus;
        }
        this.onEvent?.({ type: 'approval_resolved', taskId, tool: request.tool, approved });
        resolve(approved);
      };
      this.onEvent?.({
        type: 'approval_required',
        taskId,
        tool: request.tool,
        reason: request.reason,
        preview: request.preview,
      });
    });
  }

  /** Called externally (from the TUI hook) to answer a pending tool approval. */
  public resolveToolApproval(approved: boolean) {
    if (this.approvalResolve) {
      const resolve = this.approvalResolve;
      this.approvalResolve = null;
      resolve(approved);
    }
  }

  /** Deny every in-flight and queued approval so a cancelled mission leaves no executor hanging. */
  public abortPendingApproval() {
    this.approvalsAborted = true;
    this.resolveToolApproval(false);
  }

  /** Close a run and flush the roster. Every terminal transition goes through here. */
  private async finishRun(runId: string, status: 'completed' | 'failed', error?: string): Promise<void> {
    if (status === 'completed') this.runRegistry.complete(runId);
    else this.runRegistry.fail(runId, error ?? 'Task failed');
    await this.runRegistry.save();
  }

  async run() {
    this._mission.status = 'executing';
    
    while (this.hasPendingTasks()) {
      const currentStatus = this._mission.status as Mission['status'];
      if (currentStatus === 'awaiting_intervention') {
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      const nextTasks = this.getReadyTasks();
      const pendingCount = this.getAllTasks().filter(t => t.status === 'todo' || t.status === 'in_progress').length;
      
      log(`Scheduler loop: ${pendingCount} pending, ${nextTasks.length} ready, ${this.runningTasks.size} running`, 'DEBUG');

      if (nextTasks.length === 0 && this.runningTasks.size === 0) {
        const deadlockMessage = describeDependencyDeadlock(this.getAllTasks(), this.completedTasks);
        if (deadlockMessage) {
          log(deadlockMessage, 'ERROR');
          this._mission.status = 'failed';
          this.onEvent?.({
            type: 'task_failed',
            taskId: '',
            title: 'Mission Scheduler',
            error: deadlockMessage,
          });
        } else {
          log('Scheduler detected deadlock or completion: no ready tasks and nothing running.', 'WARN');
        }
        break;
      }

      const profile = getSmallModelRuntimeProfile(config.OLLAMA_MODEL, config.SMALL_MODEL_PROFILE);
      const concurrency = getExecutionConcurrency(nextTasks, profile?.maxConcurrentTasks ?? config.MAX_CONCURRENT_TASKS, config.ENABLE_REVIEWER);
      const availableSlots = concurrency - this.runningTasks.size;
      const tasksToStart = nextTasks.slice(0, availableSlots);

      if (tasksToStart.length > 0) {
        log(`Starting ${tasksToStart.length} tasks...`, 'INFO');
        // Inject any pending steering message into the next task
        if (this.pendingSteerMessage) {
          tasksToStart[0].userGuidance = tasksToStart[0].userGuidance
            ? `${tasksToStart[0].userGuidance}\n\n${this.pendingSteerMessage}`
            : this.pendingSteerMessage;
          this.pendingSteerMessage = '';
        }
        for (const task of tasksToStart) {
          this.executeTask(task); // fire-and-forget, manages itself
        }
      }

      // Wall-clock periodic triage check (30s)
      if (this.triageAgent && Date.now() - this.lastTriageTime >= Scheduler.TRIAGE_WALL_CLOCK_MS) {
        this.lastTriageTime = Date.now();
        try {
          const action = await this.triageAgent.analyzeTimeBased();
          await this.handleTriageAction(action);
        } catch (err: any) {
          log(`Triage time-based analysis error: ${err.message}`, 'WARN');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const terminalStatus = this._mission.status as Mission['status'];
    if (terminalStatus === 'executing' || terminalStatus === 'awaiting_intervention') {
      if (this.failedTasks.size === 0 && config.ENABLE_ADVERSARIAL_AUDIT) {
        log('Running independent Owner-as-Adversary mission review...', 'INFO');
        const modelRoles = validateReviewerModelSeparation(config.OLLAMA_MODEL, config.REVIEWER_MODEL);
        if (!modelRoles.independent) {
          const reason = modelRoles.reason ?? 'Reviewer model is not independent';
          log(reason, 'ERROR');
          this._mission.ownerReview = { approved: false, issues: [], feedback: reason };
        } else {
          this._mission.ownerReview = await new Reviewer().reviewMission(this._mission, this._mission.workspace_root);
        }
        await this.persistState?.(this._mission);
      }
      const completion = this.failedTasks.size > 0
        ? { approved: false, reasons: ['One or more tasks failed'] }
        : evaluateMissionCompletion(this._mission);
      this._mission.status = completion.approved ? 'completed' : 'failed';

      if (!completion.approved) {
        const reason = `Mission completion gate rejected success: ${completion.reasons.join('; ')}`;
        log(reason, 'ERROR');
        this.onEvent?.({ type: 'task_failed', taskId: '', title: 'Mission Completion Gate', error: reason });
      }
      
      // Memento Pattern: Persist mission summary into long-term memory
      if (this._mission.status === 'completed') {
        const completedTaskTitles = this._mission.milestones.flatMap(m => m.tasks).filter(t => t.status === 'done').map(t => t.title);
        getMemoryService().addMissionSummary(this._mission.title, completedTaskTitles).catch(e => log(`Failed to save mission memory: ${e}`, 'DEBUG'));
      }
    }
    return this._mission;
  }

  private hasPendingTasks(): boolean {
    const allTasks = this.getAllTasks();
    return allTasks.some(t => t.status === 'todo' || t.status === 'in_progress');
  }

  private getReadyTasks(): Task[] {
    const allTasks = this.getAllTasks();
    return allTasks.filter(task => {
      if (task.status !== 'todo') return false;
      if (this.runningTasks.has(task.id)) return false;
      return task.depends_on.every(depId => this.completedTasks.has(depId));
    });
  }

  private getAllTasks(): Task[] {
    return Array.from(this.taskMap.values());
  }

  private async runTriageAnalysis() {
    if (!this.triageAgent) return;
    try {
      const action = await this.triageAgent.analyzeBetweenTasks();
      await this.handleTriageAction(action);
    } catch (err: any) {
      log(`Triage analysis error: ${err.message}`, 'WARN');
    }
  }

  private emitTriageState(state: 'watching' | 'guiding' | 'escalated', message?: string) {
    if (this.lastEmittedTriageState === state) return;
    this.lastEmittedTriageState = state;
    this.onEvent?.({ type: 'triage_state', state, message });
  }

  private async handleTriageAction(action: TriageAction) {
    switch (action.type) {
      case 'continue': {
        this.emitTriageState('watching');
        break;
      }
      case 'compress':
        log(`Triage: ${action.reason}`, 'INFO');
        this.emitTriageState('watching', action.reason);
        break;
      case 'steer':
        log(`Triage: steering next task — ${action.message}`, 'INFO');
        this.pendingSteerMessage = action.message;
        this.emitTriageState('guiding', action.message);
        break;
      case 'escalate': {
        log(`Triage: escalation — ${action.reason}`, 'WARN');
        this._mission.status = 'awaiting_intervention';
        this.onEvent?.({
          type: 'intervention_required',
          taskId: this.triageAgent?.currentTaskId || '',
          error: `Triage escalation: ${action.reason}`,
          question: `The triage observer recommends intervention:\n\n${action.reason}\n\nWhat would you like to do?`,
        });
        this.emitTriageState('escalated', action.reason);
        break;
      }
    }
  }

  private async executeTask(task: Task) {
    this.runningTasks.add(task.id);
    task.status = 'in_progress';
    const attempt = (task.attemptCount || 0) + 1;
    task.attemptCount = attempt;
    const runId = `${this._mission.id}:${task.id}:${attempt}`;
    this.runRegistry.register({
      runId,
      missionId: this._mission.id,
      taskId: task.id,
      title: task.title,
      attempt,
      transcriptPath: traceFilePath(this._mission.workspace_root, task.id, attempt),
    });
    this.runRegistry.start(runId, `worker:${task.id}`);
    await this.runRegistry.save();
    this.failedTasks.delete(task.id);
    if (this.triageAgent) this.triageAgent.currentTaskId = task.id;

    this.onEvent?.({ type: 'task_started', taskId: task.id, title: task.title });
    await this.persistState?.(this._mission);

    let taskWorktree: TaskWorktree | undefined;
    try {
      let taskWorkspace = this._mission.workspace_root;
      if (config.USE_ISOLATED_WORKTREES) {
        if (await isRepositoryClean(this._mission.workspace_root)) {
          taskWorktree = await createTaskWorktree({ repo: this._mission.workspace_root, taskId: task.id });
          taskWorkspace = taskWorktree.path;
          log(`Using isolated worktree ${taskWorkspace} for ${task.title}`, 'INFO');
        } else {
          log(`Skipping isolated worktree for ${task.title}: repository has pre-existing changes`, 'WARN');
        }
      }
      const stackLine = this._mission.tech_stack && this._mission.tech_stack.length > 0
        ? `\nTech Stack: ${this._mission.tech_stack.join(', ')}`
        : '';
      const missionContext = `Mission: ${this._mission.title}\nDescription: ${this._mission.description}${stackLine}`;
      const contextPack = createContextPack(this._mission, task, {
        verifyCommands: ['npm run build', 'npm test'],
        constraints: ['no push', 'no drive-by refactor', 'stay within owned files unless required for integration'],
      });
      const workerContext = `${missionContext}\n\nWorker Context Pack:\n${JSON.stringify(contextPack, null, 2)}`;
      const trackRunProgress: OnEvent = (event) => {
        if (event.type === 'tool_call') {
          this.runRegistry.tryUpdate(runId, { currentTool: event.tool });
        } else if (event.type === 'tool_result') {
          this.runRegistry.tryUpdate(runId, {
            currentTool: undefined,
            lastOutput: event.result.success ? `${event.tool}: ok` : `${event.tool}: ${event.result.error ?? 'failed'}`,
          });
        }
        this.onEvent?.(event);
      };

      const updatedTask = await this.executor.executeTask(
        task,
        workerContext,
        taskWorkspace,
        trackRunProgress,
        this.getYoloMode,
        this._mission.tech_stack,
        {
          runId,
          missionId: this._mission.id,
          attempt,
        },
      );

      if (taskWorktree) {
        await mergeDeclaredTaskFiles({
          repo: this._mission.workspace_root,
          taskId: task.id,
          files: task.files,
        });
        taskWorktree = undefined;
      }

      this.updateTaskInMission(updatedTask);

      if (updatedTask.status === 'done') {
        // The run stays open until review and verification agree. Closing it here
        // would make every later transition a no-op, so the durable roster would
        // record success for work the reviewer went on to reject.
        // Optional Review Step — only for code tasks
        if (config.ENABLE_REVIEWER && updatedTask.type === 'code') {
          const { Reviewer } = await import('./reviewer.js');
          const reviewer = new Reviewer();

          const review = await reviewer.reviewTask(updatedTask, this._mission, this._mission.workspace_root);
          
          if (review.unverified) {
            // The reviewer never ran. Re-running the task cannot fix an unreachable
            // endpoint, so this must not consume the rejection retry budget.
            log(`Reviewer unavailable for ${updatedTask.title}; escalating without retrying: ${review.feedback}`, 'ERROR');
            await this.finishRun(runId, 'failed', review.feedback || 'Reviewer unavailable');
            updatedTask.status = 'failed';
            updatedTask.error = review.feedback || 'Reviewer unavailable; completion is unverified';
            await this.handleTaskFailure(updatedTask);
            await this.persistState?.(this._mission);
            return;
          }

          if (review.approved) {
            log(`Task approved by reviewer: ${updatedTask.title}`, 'INFO');
            updatedTask.reviewIssues = undefined;

            // Verification phase — catches orphaned CSS, broken imports, syntax errors, and build failures
            if (!await this.verifyTask(task, updatedTask)) {
              await this.finishRun(runId, 'failed', updatedTask.error || 'Verification failed');
              return;
            }
            if (!await this.attachEvidenceHandoff(updatedTask)) {
              await this.finishRun(runId, 'failed', updatedTask.error || 'Evidence handoff failed');
              return;
            }

            await this.finishRun(runId, 'completed');
            this.completedTasks.add(task.id);
            this.onEvent?.({ type: 'task_completed', taskId: task.id, title: task.title });
            await this.persistState?.(this._mission);
            await this.runTriageAnalysis();
          } else {
            log(`Task REJECTED by reviewer: ${updatedTask.title}. Feedback: ${review.feedback}`, 'WARN');
            updatedTask.reviewIssues = review.issues;
            await this.finishRun(runId, 'failed', `Review rejected: ${review.feedback ?? 'no feedback'}`);
            if (updatedTask.attemptCount && updatedTask.attemptCount < 3) {
              // Auto-retry with reviewer feedback as guidance
              log(`Auto-retrying task with reviewer feedback: ${updatedTask.title} (Attempt ${updatedTask.attemptCount})`, 'INFO');
              updatedTask.status = 'todo';
              updatedTask.error = undefined;
              updatedTask.output = undefined;
              updatedTask.userGuidance = `Reviewer feedback: ${review.feedback}\n\n${config.CODEX_ENABLED ? 'Also consult the knowledge base patterns for the correct approach.' : ''}`;
              updatedTask.extraSteps = (updatedTask.extraSteps || 0) + 10;
              this.completedTasks.delete(task.id);
              this.taskMap.set(task.id, updatedTask);
              this.runningTasks.delete(task.id);
              await this.persistState?.(this._mission);
              return;
            }
            // Max rejections or no attempt count: escalate to user
            updatedTask.status = 'failed';
            updatedTask.error = `Review Rejected repeatedly: ${review.feedback}`;
            await this.handleTaskFailure(updatedTask);
          }
        } else {
          if (config.ENABLE_REVIEWER) {
            log(`Skipping review for non-code task (type=${updatedTask.type}): ${updatedTask.title}`, 'INFO');
          }

          // Verification phase (for non-reviewer path)
          if (!await this.verifyTask(task, updatedTask)) {
            await this.finishRun(runId, 'failed', updatedTask.error || 'Verification failed');
            return;
          }
          if (!await this.attachEvidenceHandoff(updatedTask)) {
            await this.finishRun(runId, 'failed', updatedTask.error || 'Evidence handoff failed');
            return;
          }

          await this.finishRun(runId, 'completed');
          this.completedTasks.add(task.id);
          this.onEvent?.({ type: 'task_completed', taskId: task.id, title: task.title });
          await this.persistState?.(this._mission);
          await this.runTriageAnalysis();
        }
      } else {
        await this.finishRun(runId, 'failed', updatedTask.error || 'Task execution failed');
        await this.handleTaskFailure(updatedTask);
        await this.persistState?.(this._mission);
      }
    } catch (error: any) {
      if (taskWorktree) {
        try {
          await removeTaskWorktree(this._mission.workspace_root, taskWorktree.taskId);
        } catch (cleanupError: any) {
          log(`Could not clean up isolated worktree ${taskWorktree.path}: ${cleanupError.message}`, 'ERROR');
        }
      }
      await this.finishRun(runId, 'failed', error.message);
      task.status = 'failed';
      task.error = error.message;
      task.userGuidance = undefined;
      await this.handleTaskFailure(task);
      await this.persistState?.(this._mission);
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  private async handleTaskFailure(task: Task) {
    this._mission.status = 'awaiting_intervention';
    log(`Task failed, requesting intervention for: ${task.title}`, 'WARN');

    // Notify listeners about task failure
    this.onEvent?.({
      type: 'task_failed',
      taskId: task.id,
      title: task.title,
      error: task.error || 'Unknown error',
    });

    // Formulate the question (with timeout fallback)
    const question = await this.interventionManager.formulateInterventionQuestion(
      task, this._mission, task.error || 'Unknown error'
    );

    // Wait for the user's response via a Promise
    const resolution = await new Promise<InterventionResolution>((resolve) => {
      this.interventionResolve = resolve;
      this.onEvent?.({
        type: 'intervention_required',
        taskId: task.id,
        error: task.error || 'Unknown error',
        question,
      });
    });

    log(`Intervention resolved: ${resolution.action} ${resolution.message ? `"${resolution.message}"` : ''}`, 'INFO');

    // Apply the resolution directly to the task in our own taskMap
    if (resolution.action === 'fail') {
      this._mission.status = 'failed';
      this.failedTasks.add(task.id);
      this.markDependentsFailed(task.id);
      await this.persistState?.(this._mission);
      return;
    }

    if (resolution.action === 'skip') {
      task.status = 'done';
      task.output = '[Skipped by user]';
      this.completedTasks.add(task.id);
      this.onEvent?.({ type: 'task_completed', taskId: task.id, title: task.title });
      this.updateTaskInMission(task);
      this._mission.status = 'executing';
      await this.persistState?.(this._mission);
      return;
    }

    // retry or reply — reset target task and all subsequent tasks to todo
    let targetTaskId = resolution.retryFromTaskId || task.id;
    let resetActive = false;
    for (const milestone of this._mission.milestones) {
      for (const t of milestone.tasks) {
        if (t.id === targetTaskId) {
          resetActive = true;
        }
        if (resetActive) {
          t.status = 'todo';
          t.error = undefined;
          t.output = undefined;
          t.attemptCount = 0;
          t.verificationRetries = 0;
          this.completedTasks.delete(t.id);
          this.failedTasks.delete(t.id);
          this.taskMap.set(t.id, t);
        }
      }
    }

    const retryTask = this.taskMap.get(targetTaskId) ?? task;

    if (resolution.action === 'reply' && resolution.message) {
      retryTask.userGuidance = resolution.message;

      // Memento Pattern: Save user guidance as long-term preference
      getMemoryService().addUserPreference(`Guidance on task "${retryTask.title}": ${resolution.message}`).catch(e => log(`Failed to save memory: ${e}`, 'DEBUG'));

      // Smart step parsing
      let bonusSteps = 10;
      const match = resolution.message.match(/(?:add|increase|give|allow)\s+(\d+)\s+steps?/i);
      if (match) bonusSteps = parseInt(match[1], 10);
      retryTask.extraSteps = (retryTask.extraSteps || 0) + bonusSteps;

      log(`User guidance set: "${retryTask.userGuidance}" | extra steps: ${retryTask.extraSteps}`, 'INFO');
    } else {
      // plain retry — still grant extra steps
      retryTask.extraSteps = (retryTask.extraSteps || 0) + 10;
    }

    this.updateTaskInMission(retryTask);
    this._mission.status = 'executing';
    await this.persistState?.(this._mission);

    // Notify the TUI that steps changed so the footer can update
    this.onEvent?.({ type: 'steps_updated', taskId: retryTask.id, extraSteps: retryTask.extraSteps || 0 });
  }

  private async verifyTask(task: Task, updatedTask: Task): Promise<boolean> {
    const goalJudge = createDefaultGoalJudge();
    const result = await goalJudge.evaluate(updatedTask, this._mission.workspace_root);

    // Advisory repository-history findings: they never block a task, but discarding
    // them silently makes the audit pointless.
    for (const warning of result.auditWarnings ?? []) {
      log(`Repository audit warning for ${updatedTask.title}: ${warning}`, 'WARN');
      this.onEvent?.({
        type: 'system_log',
        level: 'WARN',
        message: `Repository audit: ${warning}`,
        timestamp: new Date().toISOString(),
      });
    }

    if (!result.approved) {
      log(`Verification failed for task: ${updatedTask.title}`, 'WARN');
      updatedTask.verificationRetries = (updatedTask.verificationRetries || 0) + 1;
      
      if (updatedTask.verificationRetries > 3) {
        log(`Max verification retries hit for: ${updatedTask.title}`, 'ERROR');
        updatedTask.status = 'failed';
        updatedTask.error = `Verification repeatedly failed:\n${result.feedback}`;
        await this.handleTaskFailure(updatedTask);
        return false;
      }

      // Check structural audit specifically to attach issue metadata
      const auditIssues = runStructuralAudit(this._mission.workspace_root, updatedTask.files);
      updatedTask.auditIssues = auditIssues.length > 0 ? auditIssues : undefined;

      updatedTask.status = 'todo';
      updatedTask.error = undefined;
      updatedTask.output = undefined;
      updatedTask.userGuidance = `${result.feedback}\n\nFix all structural and build compilation issues before completing the task.`;
      updatedTask.extraSteps = (updatedTask.extraSteps || 0) + 10;
      this.completedTasks.delete(task.id);
      this.taskMap.set(task.id, updatedTask);
      this.runningTasks.delete(task.id);
      return false;
    }

    return true;
  }

  private async attachEvidenceHandoff(task: Task): Promise<boolean> {
    if (task.evidenceHandoff?.status === 'done') return true;
    const workspace = this._mission.workspace_root;
    const isIntegration = /integration|final verification/i.test(`${task.title} ${task.description}`);
    let scripts: Record<string, unknown> = {};
    try {
      scripts = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')).scripts ?? {};
    } catch { /* Non-package workspaces use the Git fallback below. */ }
    const commands: string[][] = [];
    if (scripts.build) commands.push(['run', 'build']);
    if (isIntegration && scripts.test) commands.push(['test']);
    if (commands.length === 0) commands.push(['--version']);
    const commandsAndResults: Array<{ command: string; exitCode: number; summary: string }> = [];
    for (const args of commands) {
      const command = `npm ${args.join(' ')}`;
      try {
        const executable = args[0] === 'diff' ? 'git' : 'npm';
        const executableArgs = args[0] === 'diff' ? args : args;
        const result = await execFileAsync(executable, executableArgs, { cwd: workspace });
        commandsAndResults.push({ command: executable === 'git' ? `git ${args.join(' ')}` : command, exitCode: 0, summary: `${result.stdout}${result.stderr}`.trim().slice(-2000) || 'passed' });
      } catch (error: any) {
        commandsAndResults.push({ command, exitCode: typeof error.code === 'number' ? error.code : 1, summary: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(-2000) || error.message });
      }
    }
    try {
      const [head, branch, status] = await Promise.all([
        execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: workspace }),
        execFileAsync('git', ['branch', '--show-current'], { cwd: workspace }),
        execFileAsync('git', ['status', '--short'], { cwd: workspace }),
      ]);
      const changedPaths = status.stdout.split('\n').filter(Boolean).map(line => line.slice(3).trim());
      task.evidenceHandoff = createEvidenceHandoff(
        { id: task.id, status: 'done', files: changedPaths },
        { worktree: workspace, branch: branch.stdout.trim() || 'detached', baseline: head.stdout.trim(), commandsAndResults, verificationLayers: isIntegration ? ['integration'] : ['unit'], status: commandsAndResults.every(result => result.exitCode === 0) ? 'done' : 'blocked' },
      );
      return task.evidenceHandoff.status === 'done';
    } catch (error: any) {
      task.evidenceHandoff = createEvidenceHandoff(
        { id: task.id, status: 'done', files: task.files ?? [] },
        { worktree: workspace, branch: 'no-git-workspace', baseline: 'no-git-baseline', commandsAndResults, verificationLayers: isIntegration ? ['integration'] : ['unit'], status: commandsAndResults.every(result => result.exitCode === 0) ? 'done' : 'blocked' },
      );
      if (task.evidenceHandoff.status === 'done') return true;
      task.error = `Evidence verification failed and Git state is unavailable: ${error.message}`;
      return false;
    }
  }

  private markDependentsFailed(failedTaskId: string) {
    for (const [id, task] of this.taskMap) {
      if (task.depends_on.includes(failedTaskId) && task.status === 'todo') {
        task.status = 'failed';
        task.error = `Dependency ${failedTaskId} failed`;
        this.failedTasks.add(id);
        this.markDependentsFailed(id);
      }
    }
  }

  private updateTaskInMission(updatedTask: Task) {
    for (const milestone of this._mission.milestones) {
      const index = milestone.tasks.findIndex(t => t.id === updatedTask.id);
      if (index !== -1) {
        milestone.tasks[index] = updatedTask;
        break;
      }
    }
    this.taskMap.set(updatedTask.id, updatedTask);
  }

  public addTask(milestoneId: string, newTask: Task) {
    const milestone = this._mission.milestones.find(m => m.id === milestoneId);
    if (milestone) {
      milestone.tasks.push(newTask);
      this.taskMap.set(newTask.id, newTask);
    }
  }
}
