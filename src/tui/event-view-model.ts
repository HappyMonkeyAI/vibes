import type { ExecutionEvent } from '../agent/types.js';

export interface LiveEventState {
  completed: ExecutionEvent[];
  activeThinking: string;
  activeOutput: string;
  backlog: number;
}

export function createLiveEventState(): LiveEventState {
  return { completed: [], activeThinking: '', activeOutput: '', backlog: 0 };
}

export function isStreamDeltaEvent(event: ExecutionEvent): boolean {
  return event.type === 'thinking_delta' || event.type === 'output_delta';
}

export function applyLiveEvent(
  state: LiveEventState,
  event: ExecutionEvent,
  maxCompleted = 1000,
): LiveEventState {
  return applyLiveEvents(state, [event], maxCompleted);
}

/**
 * Fold a whole flush batch in one pass. Copying the completed history per event
 * costs O(batch × maxCompleted); building the batch first makes it O(batch + maxCompleted).
 */
export function applyLiveEvents(
  state: LiveEventState,
  events: ExecutionEvent[],
  maxCompleted = 1000,
): LiveEventState {
  if (events.length === 0) return state;

  let activeThinking = state.activeThinking;
  let activeOutput = state.activeOutput;
  const appended: ExecutionEvent[] = [];

  for (const event of events) {
    if (event.type === 'thinking_delta') {
      activeThinking += event.content;
    } else if (event.type === 'output_delta') {
      activeOutput += event.content;
    } else {
      appended.push(event);
      if (event.type === 'thinking') activeThinking = event.content;
      if (event.type === 'output') activeOutput = event.content;
    }
  }

  const completed = appended.length === 0
    ? state.completed
    : [...state.completed, ...appended].slice(-maxCompleted);

  return {
    completed,
    activeThinking,
    activeOutput,
    backlog: state.backlog + events.length,
  };
}

export function flushLiveEventState(state: LiveEventState): LiveEventState {
  return { ...state, backlog: 0 };
}
