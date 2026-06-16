import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { config } from '../config.js';
import { log } from '../logger.js';
import { estimateMessagesTokens, getUsableBudget } from './context-manager.js';
import { 
  parseMemory, 
  parseCheckpoint, 
  parseNotes, 
  parseProgress 
} from './state-schemas.js';
import fs from 'fs/promises';
import path from 'path';

export interface ReconstructionConfig {
  /** Token threshold to trigger reconstruction (e.g., 0.8 for 80% usage) */
  threshold: number;
  /** Whether the feature is enabled */
  enabled: boolean;
  /** State directory */
  stateDir: string;
}

export const defaultReconstructionConfig: ReconstructionConfig = {
  threshold: 0.8,
  enabled: config.ENABLE_CONTEXT_RECONSTRUCTION || false,
  stateDir: path.join(process.cwd(), '.vibes', 'state'),
};

export class ReconstructionController {
  private config: ReconstructionConfig;

  constructor(cfg: Partial<ReconstructionConfig> = {}) {
    this.config = { ...defaultReconstructionConfig, ...cfg };
  }

  /**
   * Checks if reconstruction should be triggered based on current token usage.
   */
  shouldReconstruct(messages: ChatCompletionMessageParam[]): boolean {
    if (!this.config.enabled) return false;

    const estimated = estimateMessagesTokens(messages);
    const budget = getUsableBudget();
    const ratio = estimated / budget;

    return ratio >= this.config.threshold;
  }

  /**
   * Reconstructs the context from state files.
   * Returns a lean message array.
   */
  async reconstruct(workspaceRoot: string, lastVerbatimTurns: number = 2): Promise<ChatCompletionMessageParam[]> {
    log('Triggering context reconstruction...', 'INFO');

    const stateFiles = {
      memory: path.join(workspaceRoot, 'MEMORY.md'),
      checkpoint: path.join(workspaceRoot, 'checkpoint.md'),
      notes: path.join(workspaceRoot, 'notes.md'),
      progress: path.join(workspaceRoot, 'progress.md'),
    };

    let memoryContent = '';
    let checkpointContent = '';
    let notesContent = '';
    let progressContent = '';

    try {
      memoryContent = await fs.readFile(stateFiles.memory, 'utf8').catch(() => '');
      checkpointContent = await fs.readFile(stateFiles.checkpoint, 'utf8').catch(() => '');
      notesContent = await fs.readFile(stateFiles.notes, 'utf8').catch(() => '');
      progressContent = await fs.readFile(stateFiles.progress, 'utf8').catch(() => '');
    } catch (err) {
      log(`Failed to read state files during reconstruction: ${err instanceof Error ? err.message : String(err)}`, 'WARN');
    }

    const messages: ChatCompletionMessageParam[] = [];

    // 1. System Prompt (will be prepended by TaskExecutor, but we can add reconstructed sections)
    let reconstructionUserMessage = `[CONTEXT RECONSTRUCTED]\n\nThe previous conversation history was archived to save space. Here is the current execution state derived from state files:\n\n`;

    if (memoryContent) {
      reconstructionUserMessage += `### Project Memory\n${memoryContent}\n\n`;
    }

    if (checkpointContent) {
      reconstructionUserMessage += `### Latest Checkpoint\n${checkpointContent}\n\n`;
    }

    if (progressContent) {
      reconstructionUserMessage += `### Current Progress\n${progressContent}\n\n`;
    }

    if (notesContent) {
      // Potentially truncate notes if they are too long
      reconstructionUserMessage += `### Scratchpad Notes\n${notesContent}\n\n`;
    }

    messages.push({
      role: 'user',
      content: reconstructionUserMessage.trim()
    });

    return messages;
  }

  /**
   * Helper to preserve recent turns. 
   * TaskExecutor will handle merging this with the reconstructed message.
   */
  getVerbatimTail(messages: ChatCompletionMessageParam[], turnCount: number): ChatCompletionMessageParam[] {
    // A turn is usually an assistant message followed by its tool results, or just an assistant message.
    // This is a simplified version; real logic might need to be more robust.
    const tail: ChatCompletionMessageParam[] = [];
    let assistantMessagesFound = 0;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant') {
        assistantMessagesFound++;
      }
      tail.unshift(msg);
      if (assistantMessagesFound >= turnCount && msg.role !== 'tool') {
        break;
      }
    }
    
    return tail;
  }
}
