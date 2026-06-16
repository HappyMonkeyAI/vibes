import { log } from '../logger.js';

export interface GovernorConfig {
  maxTurns: number;
  maxTokens: number;
  thrashThreshold: number;
}

export class Governor {
  private config: GovernorConfig;
  private consecutiveFailingTurnSequences: string[] = [];
  private totalTokensUsed: number = 0;

  constructor(config: GovernorConfig) {
    this.config = config;
  }

  /**
   * Check if the current execution turn count exceeds the limit.
   */
  public isTurnLimitExceeded(currentTurn: number): boolean {
    return currentTurn >= this.config.maxTurns;
  }

  /**
   * Check if the token usage exceeds the configured max budget.
   */
  public isTokenLimitExceeded(tokensUsed: number): boolean {
    this.totalTokensUsed = tokensUsed;
    return tokensUsed >= this.config.maxTokens;
  }

  /**
   * Circuit breaker to check if the agent is stuck in an infinite loops or thrashing.
   * If consecutive tool sequences fail with the same arguments, return true.
   */
  public shouldBreak(toolCalls: any[], toolResults: any[]): boolean {
    if (!toolCalls || toolCalls.length === 0) return false;

    // Successful tool results reset the consecutive failure tracker.
    const allToolResultsFailed = toolResults.length > 0 && toolResults.every(r => !r.success);
    if (!allToolResultsFailed) {
      this.consecutiveFailingTurnSequences = [];
      return false;
    }

    // Capture the name and arguments of the tool calls to build a signature
    const currentTurnSequence = toolCalls
      .map((tc: any) => `${tc.function?.name || tc.name}:${JSON.stringify(tc.function?.arguments || tc.args)}`)
      .join('|');

    this.consecutiveFailingTurnSequences.push(currentTurnSequence);
    if (this.consecutiveFailingTurnSequences.length > this.config.thrashThreshold) {
      this.consecutiveFailingTurnSequences.shift();
    }

    if (this.consecutiveFailingTurnSequences.length === this.config.thrashThreshold) {
      const first = this.consecutiveFailingTurnSequences[0];
      const allIdentical = this.consecutiveFailingTurnSequences.every(seq => seq === first);
      if (allIdentical) {
        log(`Circuit breaker tripped: Detected ${this.config.thrashThreshold} identical failing tool sequences consecutively.`, 'WARN');
        return true;
      }
    }

    return false;
  }

  /**
   * Reset the tracker at task boundary.
   */
  public reset() {
    this.consecutiveFailingTurnSequences = [];
    this.totalTokensUsed = 0;
  }

  /**
   * Get current token usage metrics for TUI display.
   */
  public getMetrics() {
    return {
      totalTokensUsed: this.totalTokensUsed,
      limit: this.config.maxTokens,
    };
  }
}
