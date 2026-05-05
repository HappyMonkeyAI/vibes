import { log } from '../logger.js';
import { ExecutionEvent, Task, Mission } from '../agent/types.js';
import fs from 'fs';
import path from 'path';

export enum HookEvent {
  BEFORE_THINKING = 'before_thinking',
  AFTER_THINKING = 'after_thinking',
  BEFORE_TOOL_CALL = 'before_tool_call',
  AFTER_TOOL_CALL = 'after_tool_call',
  BEFORE_TASK = 'before_task',
  AFTER_TASK = 'after_task',
  BEFORE_MISSION = 'before_mission',
  AFTER_MISSION = 'after_mission',
  ON_ERROR = 'on_error',
}

export interface HookContext {
  mission?: Mission;
  task?: Task;
  step?: number;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  thinking?: string;
  error?: Error;
  [key: string]: any;
}

export type HookFunction = (event: HookEvent, context: HookContext) => void | Promise<void>;

export interface HookDefinition {
  name: string;
  description?: string;
  events: HookEvent[];
  handler: HookFunction;
  enabled?: boolean;
}

export class HooksService {
  private hooks: Map<string, HookDefinition> = new Map();
  private hooksPath: string;

  constructor(hooksPath?: string) {
    this.hooksPath = hooksPath || path.join(process.cwd(), '.vibes', 'hooks.json');
    this.loadHooks();
  }

  private loadHooks() {
    if (!fs.existsSync(this.hooksPath)) {
      log(`Hooks config not found: ${this.hooksPath}`, 'DEBUG');
      return;
    }

    try {
      const content = fs.readFileSync(this.hooksPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.hooks && Array.isArray(config.hooks)) {
        for (const hook of config.hooks) {
          if (hook.enabled === false) continue;
          
          const handler = this.createHandler(hook);
          if (handler) {
            this.hooks.set(hook.name, {
              name: hook.name,
              description: hook.description,
              events: hook.events || [],
              handler,
              enabled: hook.enabled !== false,
            });
          }
        }
      }

      log(`Loaded ${this.hooks.size} hooks`, 'INFO');
    } catch (error: any) {
      log(`Failed to load hooks: ${error.message}`, 'ERROR');
    }
  }

  private createHandler(hookConfig: any): HookFunction | null {
    if (hookConfig.type === 'command') {
      const command = hookConfig.command;
      return async (event: HookEvent, context: HookContext) => {
        try {
          const { exec } = await import('child_process');
          const env = {
            ...process.env,
            VIBES_HOOK_EVENT: event,
            VIBES_HOOK_CONTEXT: JSON.stringify(context),
          };
          
          exec(command, { env }, (error, stdout, stderr) => {
            if (error) {
              log(`Hook ${hookConfig.name} error: ${error.message}`, 'ERROR');
            } else if (stdout) {
              log(`Hook ${hookConfig.name} output: ${stdout}`, 'DEBUG');
            }
          });
        } catch (error: any) {
          log(`Hook ${hookConfig.name} failed: ${error.message}`, 'ERROR');
        }
      };
    }

    return null;
  }

  register(hook: HookDefinition) {
    this.hooks.set(hook.name, hook);
    log(`Registered hook: ${hook.name}`, 'INFO');
  }

  unregister(name: string) {
    this.hooks.delete(name);
    log(`Unregistered hook: ${name}`, 'INFO');
  }

  async emit(event: HookEvent, context: HookContext = {}) {
    const relevantHooks = Array.from(this.hooks.values())
      .filter(h => h.enabled && h.events.includes(event));

    for (const hook of relevantHooks) {
      try {
        await hook.handler(event, context);
      } catch (error: any) {
        log(`Hook ${hook.name} error: ${error.message}`, 'ERROR');
      }
    }
  }

  getHooksForEvent(event: HookEvent): HookDefinition[] {
    return Array.from(this.hooks.values())
      .filter(h => h.enabled && h.events.includes(event));
  }

  isEnabled(): boolean {
    return this.hooks.size > 0;
  }
}

let globalHooksService: HooksService | null = null;

export function getHooksService(): HooksService {
  if (!globalHooksService) {
    globalHooksService = new HooksService();
  }
  return globalHooksService;
}

export const createBuiltInHooks = (): HookDefinition[] => {
  return [
    {
      name: 'log-events',
      description: 'Log all events to console',
      events: Object.values(HookEvent),
      handler: async (event, context) => {
        log(`[Hook] ${event}: ${JSON.stringify(context).slice(0, 100)}`, 'DEBUG');
      },
    },
  ];
};