import { v4 as uuidv4 } from 'uuid';
import { getOllamaClient, getModel } from '../ollama-client.js';
import { config } from '../config.js';
import { Mission, MissionSchema } from './types.js';
import { logObject, log } from '../logger.js';
import { repairJson, extractJsonContent } from './json-repair.js';
import { getMemoryService } from '../memory/index.js';
import { detectTechStack } from './tech-stack.js';
import { getModelSpecificPrompt } from './model-prompts.js';

export class MissionPlanner {
  private memory = getMemoryService();

  async planMission(description: string, workspaceRoot: string = process.cwd()): Promise<Mission> {
    log(`Planning mission: ${description}`, 'INFO');

    let memoriesSection = '';
    if (this.memory.isEnabled()) {
      const relevantMemories = await this.memory.retrieveRelevant(
        `${workspaceRoot} ${description}`,
        5
      );
      memoriesSection = this.memory.formatMemoriesForPrompt(relevantMemories);
    }

    // Project Rules Discovery Hack (excluding execution-specific constitution files like AGENTS.md and PROMPT.md)
    let projectRules = '';
    const ruleFiles = ['.cursorrules', 'DESIGN.md', 'GEMINI.md', 'CLAUDE.md', 'VIBES.md'];
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      for (const file of ruleFiles) {
        const fullPath = path.join(workspaceRoot, file);
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          projectRules += `\n\n[PROJECT RULES (${file})]:\n${content}\n`;
          log(`Loaded project rules for planning from ${file}`, 'INFO');
        } catch {
          // File not found
        }
      }
    } catch (err) {
      log(`Failed to discover project rules for planning: ${err instanceof Error ? err.message : String(err)}`, 'DEBUG');
    }

    // Tech Stack Detection
    const stack = detectTechStack(workspaceRoot);
    log(`Mission planner: detected tech stack: ${stack.join(', ') || 'unknown'}`, 'INFO');
    const stackContext = stack.length > 0
      ? `\n[WORKSPACE TECH STACK]: ${stack.join(', ')}\nTailor all task file paths, languages, and implementation approaches to this stack.\n`
      : '';

    const plannerModel = config.PLANNER_MODEL || getModel();
    const modelSpecificPrompt = getModelSpecificPrompt(plannerModel, 'planner');

    const systemPrompt = `You are a mission planning agent. Break the mission into milestones and tasks.
Output ONLY a JSON object.
${memoriesSection}
${projectRules}
${stackContext}
${modelSpecificPrompt}

Structure:
{
  "title": "Mission Title",
  "description": "Short overview",
  "milestones": [
    {
      "title": "Milestone Title",
      "description": "Short desc",
      "tasks": [
        {
          "title": "Task Title",
          "description": "Actionable steps",
          "files": ["file/path"],
          "acceptance_criteria": ["criteria 1", "criteria 2"],
          "use_reviewer_model": true,
          "type": "code",
          "depends_on": ["Prerequisite Task Title"]
        }
      ]
    }
  ]
}

Constraints:
1. MAX 3 milestones.
2. MAX 5 tasks per milestone.
3. Keep descriptions very short.
4. Focus on the primary goal first.
5. If a task is particularly complex (e.g. refactoring core logic, multi-file changes), set "use_reviewer_model" to true.
6. Classify each task's "type": "code" (writing code), "config" (changing configs, package.json, env files), or "research" (analysis, reading files, gathering info). Only "code" tasks trigger automated review.
7. No extra text or preamble.
8. STOP when the acceptance criteria are met. Do not add extra polish, build pipelines, or deployment steps unless explicitly requested.
9. **ATOMIC TASKS** — Each task must be atomic with clearly bounded scope. Avoid open-ended descriptions like "multiple shapes" — enumerate specific, discrete deliverables instead (e.g. "Create a SkeletonCircle component" not "Add multiple shapes"). If a requirement implies open-ended work, break it into one task per concrete deliverable.
10. **STRICT BOUNDARIES** — plans MUST NOT include tasks that:
- Generate SSL/TLS certificates, SSH keys, API keys, secrets, or any credentials.
- Run network tools: curl, wget, scp, rsync, ssh, sftp, nc.
- Push to or clone from remote git repositories.
- Install global packages (npm -g, pip --system, yarn global).
- Use sudo, su, chown, or escalate privileges.
- Create Docker, Kubernetes, CI/CD, or deployment infrastructure (unless the user's request explicitly mentions deployment).
- Write files outside the provided workspace directory.
- Use openssl, ssh-keygen, gpg, or any cryptography tooling.

11. A request for a "web app" means: HTML, CSS, and JavaScript files only. Not a build pipeline, not a service worker, not a deployment config — unless explicitly asked.
12. Define task dependencies in the "depends_on" field using the exact titles of prerequisite tasks in the plan. If there are no prerequisites, use an empty array. Design the plan so that file creation, code implementation, test suites, and manual verifications follow a logical sequence. Dependencies must be acyclic: never create circular chains (e.g. "Create Component" must not depend on "Add Component Styling" if styling depends on that component). Component implementation tasks come before styling tasks that import those components.
13. When planning a React, Vite, or web application project, ensure that the project setup or configuration task includes all necessary root entrypoint and index files (such as \`index.html\`, \`src/main.tsx\`, \`src/index.tsx\`, etc. as appropriate for the stack) in its file list so that subsequent build verification checks do not fail due to missing entry modules.`;

    const response = await getOllamaClient('planner').chat.completions.create({
      model: plannerModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please plan a mission for the following request:\n\n<request>\n${description}\n</request>` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    });

    const message = response.choices[0]?.message as any;
    // Reasoning models (phi-4-mini-reasoning, DeepSeek-R1, Gemma-QAT, etc.)
    // emit their output in `reasoning_content` or `reasoning` with empty `content`.
    let content: string | null | undefined =
      message?.content
      || message?.reasoning_content
      || message?.reasoning;

    logObject('Planner Raw Response', message);

    if (!content) {
      const presentKeys = Object.keys(message ?? {}).join(', ');
      throw new Error(
        `Failed to get response from mission planner — model returned no usable content. ` +
        `Present keys: [${presentKeys}]. Finish reason: ${response.choices[0]?.finish_reason ?? 'unknown'}.`
      );
    }
    content = content as string;

    // Strip reasoning blocks before attempting any JSON parse.
    // Reasoning models (DeepSeek-R1, Qwen-QwQ, etc.) prepend <think>...</think>
    // to their output. extractJsonContent handles both closed and unclosed tags.
    content = extractJsonContent(content);
    log(`Planner content after think-strip (first 120 chars): ${content.slice(0, 120)}`, 'DEBUG');

    let rawPlan;
    // Retry once with a more forceful prompt if the model returns no JSON or parrots template
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // First attempt already has content; retry must make a new API call
        if (attempt === 1) {
          log('Retrying planner with stronger JSON-only prompt...', 'WARN');
          const retryResponse = await getOllamaClient('planner').chat.completions.create({
            model: plannerModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'assistant', content: content },
              { role: 'user', content: `Your previous response was invalid (either invalid JSON or parroted the example template placeholders literally). Output ONLY a raw JSON object detailing the actual plan for this mission. Do not use placeholder titles like "Mission Title", "Milestone Title", or "Task Title". Make sure all milestones, tasks, and files are specific to the request.\n\nPlease plan a mission for:\n\n${description}` },
            ],
            temperature: 0.1,
            max_tokens: 4096,
          });
          const retryMsg = retryResponse.choices[0]?.message as any;
          content = extractJsonContent(
            (retryMsg?.content || retryMsg?.reasoning_content || retryMsg?.reasoning || content) as string
          );
        }

        try {
          rawPlan = JSON.parse(content);
        } catch (e) {
          log('Initial JSON parse failed, attempting repair...', 'WARN');
          const repaired = repairJson(content);
          if (repaired === null) {
            throw new Error(`Model returned no JSON content. Raw: ${content.slice(0, 100)}...`);
          }
          logObject('Repaired JSON', repaired);
          rawPlan = JSON.parse(repaired);
        }

        if (this.isParrotedTemplate(rawPlan)) {
          throw new Error('Model parroted the system prompt placeholder template instead of planning the user request.');
        }

        break; // success
      } catch (err: any) {
        if (attempt === 1) {
          log(`JSON parse failed after retry: ${err.message}`, 'ERROR');
          throw new Error(`Invalid JSON from model: ${err.message}\nRaw content: ${content.slice(0, 100)}...`);
        }
        log(`JSON parse failed (attempt ${attempt + 1}): ${err.message}`, 'WARN');
      }
    }

    try {
      // Unwrap common model mis-wrappings:
      //   { "plan": { "milestones": [...] } }
      //   { "mission": { "milestones": [...] } }
      //   [ { "milestones": [...] } ]  (array-wrapped)
      if (rawPlan && !Array.isArray(rawPlan.milestones)) {
        const inner = rawPlan.plan ?? rawPlan.mission ?? rawPlan.result ?? rawPlan.output;
        if (inner && Array.isArray(inner.milestones)) {
          rawPlan = inner;
        }
      }

      if (!rawPlan || !Array.isArray(rawPlan.milestones)) {
        throw new Error(
          `Model returned JSON without a "milestones" array. ` +
          `Got top-level keys: [${Object.keys(rawPlan ?? {}).join(', ')}]. ` +
          `Raw (first 200 chars): ${content.slice(0, 200)}`
        );
      }

      // 1. Assign a unique ID to every task and build a mapping of normalized title -> ID
      const taskTitleToIdMap = new Map<string, string>();
      const taskList: any[] = [];

      rawPlan.milestones.forEach((m: any) => {
        if (m.tasks && Array.isArray(m.tasks)) {
          m.tasks.forEach((t: any) => {
            const taskId = uuidv4();
            t.id = taskId;
            taskTitleToIdMap.set(t.title.trim().toLowerCase(), taskId);
            taskList.push(t);
          });
        }
      });

      // 2. Map string dependencies in depends_on to task UUIDs
      rawPlan.milestones.forEach((m: any) => {
        if (m.tasks && Array.isArray(m.tasks)) {
          m.tasks.forEach((t: any) => {
            const resolvedDeps: string[] = [];
            if (t.depends_on && Array.isArray(t.depends_on)) {
              t.depends_on.forEach((depTitle: string) => {
                const depTitleNorm = depTitle.trim().toLowerCase();
                const matchedId = taskTitleToIdMap.get(depTitleNorm);
                if (matchedId && matchedId !== t.id) {
                  resolvedDeps.push(matchedId);
                } else if (matchedId !== t.id) {
                  // Fallback: search for a task title that contains or matches closely
                  let found = false;
                  for (const [title, id] of taskTitleToIdMap.entries()) {
                    if (id !== t.id && (title.includes(depTitleNorm) || depTitleNorm.includes(title))) {
                      resolvedDeps.push(id);
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    log(`Warning: Could not resolve dependency "${depTitle}" for task "${t.title}"`, 'WARN');
                  }
                }
              });
            }
            t.depends_on = resolvedDeps;
          });
        }
      });

      // 3. Fallback sequential milestone dependencies: If a task in milestone M > 0 
      // has no resolved dependencies, make it depend on all tasks in milestone M-1.
      for (let i = 1; i < rawPlan.milestones.length; i++) {
        const prevMilestone = rawPlan.milestones[i - 1];
        const currentMilestone = rawPlan.milestones[i];
        const prevMilestoneTaskIds = Array.isArray(prevMilestone.tasks)
          ? prevMilestone.tasks.map((t: any) => t.id)
          : [];

        if (Array.isArray(currentMilestone.tasks)) {
          currentMilestone.tasks.forEach((t: any) => {
            if (!t.depends_on || t.depends_on.length === 0) {
              t.depends_on = [...prevMilestoneTaskIds];
            }
          });
        }
      }

      // Assemble final mission plan
      const planWithIds = {
        ...rawPlan,
        id: uuidv4(),
        status: 'planning',
        workspace_root: workspaceRoot,
        tech_stack: stack.length > 0 ? stack : undefined,
        milestones: rawPlan.milestones.map((m: any) => ({
          ...m,
          id: m.id || uuidv4(),
          description: m.description || m.title || '',
          tasks: Array.isArray(m.tasks) ? m.tasks.map((t: any) => ({
            ...t,
            type: ['code', 'config', 'research', 'unknown'].includes(t.type) ? t.type : 'code',
            status: 'todo',
            depends_on: t.depends_on || [],
          })) : [],
        })),
      };

      const mission = MissionSchema.parse(planWithIds);

      // Post-plan validation: check that key entities from the original request
      // appear somewhere in the plan. This catches cases where the planner silently
      // drops requirements (e.g., "Input component" dropped from "Button, Input, Card, Badge").
      this.validatePlanCoverage(description, mission);

      return mission;
    } catch (error: any) {
      log(`Failed to process mission plan: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  private isParrotedTemplate(rawPlan: any): boolean {
    if (!rawPlan) return false;
    
    // Check top level title
    const title = String(rawPlan.title || '').trim().toLowerCase();
    if (title === 'mission title') return true;

    // Check milestones and tasks
    if (Array.isArray(rawPlan.milestones)) {
      for (const m of rawPlan.milestones) {
        const mTitle = String(m.title || '').trim().toLowerCase();
        if (mTitle === 'milestone title') return true;

        if (Array.isArray(m.tasks)) {
          for (const t of m.tasks) {
            const tTitle = String(t.title || '').trim().toLowerCase();
            if (tTitle === 'task title') return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Lightweight post-plan validation: extract key entities from the user's
   * original request and warn if any are absent from the generated plan.
   * This is a best-effort heuristic, not a hard gate — it logs warnings
   * so the issue is visible in session logs and triage.
   */
  private validatePlanCoverage(description: string, mission: Mission): void {
    // Extract candidate entity names: capitalized words, quoted strings,
    // and words following common patterns like "a X component", "an X"
    const candidates = new Set<string>();

    // Pattern 1: Capitalized words (likely component/entity names)
    const capitalizedWords = description.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
    for (const word of capitalizedWords) {
      // Skip common filler words
      if (!['Create', 'Build', 'Make', 'Add', 'Write', 'Implement', 'React', 'Use', 'With', 'The', 'And', 'All', 'No', 'Each'].includes(word)) {
        candidates.add(word.toLowerCase());
      }
    }

    // Pattern 2: "a/an X component/module/page/service"
    const componentPattern = /\b(?:a|an)\s+([A-Za-z]+)\s+(?:component|module|page|service|class|hook|widget)/gi;
    let match;
    while ((match = componentPattern.exec(description)) !== null) {
      candidates.add(match[1].toLowerCase());
    }

    if (candidates.size === 0) return;

    // Build a searchable string from all task titles and descriptions
    const planText = mission.milestones
      .flatMap(m => m.tasks)
      .map(t => `${t.title} ${t.description}`)
      .join(' ')
      .toLowerCase();

    const missing: string[] = [];
    for (const entity of candidates) {
      if (!planText.includes(entity)) {
        missing.push(entity);
      }
    }

    if (missing.length > 0) {
      log(`Plan coverage warning: the following entities from the user request may be missing from the plan: [${missing.join(', ')}]`, 'WARN');
    }
  }
}
