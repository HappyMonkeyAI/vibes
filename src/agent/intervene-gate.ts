/**
 * ProPerAgent-shaped gate (T26): map KEV choice → continue / escalate / skip.
 * Thresholds use probabilities, never confidence. Abstention → escalate.
 */

export type InterveneChoice = 'continue' | 'escalate' | 'skip';

export interface InterveneGateInput {
  choice?: string | null;
  probabilities?: Record<string, number> | null;
  minMargin?: number;
}

export interface InterveneGateResult {
  action: InterveneChoice;
  reason: string;
  topProbability?: number;
  margin?: number;
}

function normalizeChoice(raw: string | null | undefined): InterveneChoice | null {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (key === 'continue' || key === 'escalate' || key === 'skip') return key;
  return null;
}

export function decideInterveneAction(input: InterveneGateInput): InterveneGateResult {
  const minMargin = input.minMargin ?? 0.05;
  const choice = normalizeChoice(input.choice ?? undefined);
  const probs = input.probabilities && typeof input.probabilities === 'object'
    ? input.probabilities
    : null;

  if (!choice) {
    return { action: 'escalate', reason: 'Decision model returned no usable choice — escalate to operator' };
  }

  if (!probs) {
    if (choice === 'continue') {
      return { action: 'escalate', reason: 'Continue chosen without probabilities — escalate to be safe' };
    }
    return { action: choice, reason: `Decision model chose ${choice} (no probability vector)` };
  }

  const ranked = Object.entries(probs)
    .filter(([, p]) => typeof p === 'number' && Number.isFinite(p))
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  const topProbability = top?.[1];
  const margin = top && second ? top[1] - second[1] : topProbability;

  if (top && normalizeChoice(top[0]) && normalizeChoice(top[0]) !== choice) {
    const argmax = normalizeChoice(top[0])!;
    if (typeof margin === 'number' && margin < minMargin) {
      return {
        action: 'escalate',
        reason: `Ambiguous top options (margin ${margin.toFixed(3)} < ${minMargin}) — escalate`,
        topProbability,
        margin,
      };
    }
    return {
      action: argmax,
      reason: `Using probability argmax '${argmax}' over reported choice '${choice}'`,
      topProbability,
      margin,
    };
  }

  if (typeof margin === 'number' && margin < minMargin) {
    return {
      action: 'escalate',
      reason: `Ambiguous top options (margin ${margin.toFixed(3)} < ${minMargin}) — escalate`,
      topProbability,
      margin,
    };
  }

  return {
    action: choice,
    reason: `Decision model chose ${choice}`,
    topProbability,
    margin,
  };
}

export function toAutoResolution(
  action: InterveneChoice,
): { action: 'retry' | 'skip'; message: string } | null {
  if (action === 'continue') {
    return { action: 'retry', message: 'Decision model: continue — auto-retry without operator' };
  }
  if (action === 'skip') {
    return { action: 'skip', message: 'Decision model: skip blocked work' };
  }
  return null;
}
