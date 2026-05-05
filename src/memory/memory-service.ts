import { MemoryClient } from 'mem0ai';
import { log, logObject } from '../logger.js';

export interface MemoryOptions {
  userId?: string;
  sessionId?: string;
}

export class MemoryService {
  private client: MemoryClient | null = null;
  private userId: string;
  private enabled: boolean = false;

  constructor(userId: string = 'default') {
    this.userId = userId;
    this.initialize();
  }

  private async initialize() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.MEM0_API_KEY;
    
    if (!apiKey) {
      log('Memory service: No API key found, disabling memory', 'WARN');
      return;
    }

    try {
      this.client = new MemoryClient({ apiKey });
      this.enabled = true;
      log(`Memory service initialized for user: ${this.userId}`, 'INFO');
    } catch (error: any) {
      log(`Failed to initialize memory service: ${error.message}`, 'ERROR');
      this.enabled = false;
    }
  }

  async addUserPreference(preference: string, category: string = 'general') {
    if (!this.enabled || !this.client) return;
    
    try {
      await this.client.add(
        [{ role: 'user', content: `[${category}] ${preference}` }],
        { user_id: this.userId }
      );
      log(`Added user preference: ${preference}`, 'DEBUG');
    } catch (error: any) {
      log(`Failed to add preference: ${error.message}`, 'ERROR');
    }
  }

  async addContext(context: string, metadata?: Record<string, any>) {
    if (!this.enabled || !this.client) return;
    
    try {
      await this.client.add(
        [{ role: 'user', content: context }],
        { user_id: this.userId, ...metadata }
      );
      log(`Added context: ${context.slice(0, 50)}...`, 'DEBUG');
    } catch (error: any) {
      log(`Failed to add context: ${error.message}`, 'ERROR');
    }
  }

  async addToolUsage(toolName: string, args: Record<string, any>, result: any) {
    if (!this.enabled || !this.client) return;
    
    const content = `Used tool: ${toolName} with args: ${JSON.stringify(args)}. Result: ${JSON.stringify(result).slice(0, 200)}`;
    await this.addContext(content, { type: 'tool_usage', tool: toolName });
  }

  async retrieveRelevant(query: string, topK: number = 5): Promise<string[]> {
    if (!this.enabled || !this.client) return [];
    
    try {
      const results = await this.client.search(query, {
        user_id: this.userId,
        limit: topK,
      });
      
      const memories = results.map((r: any) => r.content) || [];
      log(`Retrieved ${memories.length} relevant memories`, 'DEBUG');
      return memories;
    } catch (error: any) {
      log(`Failed to retrieve memories: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async getUserPreferences(): Promise<string[]> {
    return this.retrieveRelevant('user preference settings', 10);
  }

  async getRecentContext(limit: number = 10): Promise<string[]> {
    return this.retrieveRelevant('code context file structure workspace', limit);
  }

  formatMemoriesForPrompt(memories: string[]): string {
    if (memories.length === 0) return '';
    
    const formatted = memories.map((m, i) => `${i + 1}. ${m}`).join('\n');
    return `\nRelevant memories from previous sessions:\n${formatted}\n`;
  }

  async addConversationTurn(role: 'user' | 'assistant', content: string) {
    const prefix = role === 'user' ? 'User said:' : 'Assistant responded:';
    await this.addContext(`${prefix} ${content}`, { type: 'conversation', role });
  }

  async addMissionSummary(missionTitle: string, tasksCompleted: string[]) {
    const content = `Completed mission: ${missionTitle}. Tasks: ${tasksCompleted.join(', ')}`;
    await this.addContext(content, { type: 'mission', title: missionTitle });
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

let globalMemoryService: MemoryService | null = null;

export function getMemoryService(userId?: string): MemoryService {
  if (!globalMemoryService) {
    globalMemoryService = new MemoryService(userId || 'default_user');
  }
  return globalMemoryService;
}