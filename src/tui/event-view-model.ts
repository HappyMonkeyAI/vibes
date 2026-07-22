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

export function applyLiveEvent(
  state: LiveEventState,
  event: ExecutionEvent,
  maxCompleted = 1000,
): LiveEventState {
  const next: LiveEventState = {
    completed: state.completed,
    activeThinking: state.activeThinking,
    activeOutput: state.activeOutput,
    backlog: state.backlog + 1,
  };

  if (event.type === 'thinking_delta') {
    next.activeThinking += event.content;
  } else if (event.type === 'output_delta') {
    next.activeOutput += event.content;
  } else {
    next.completed = [...state.completed, event].slice(-maxCompleted);
    if (event.type === 'thinking') next.activeThinking = event.content;
    if (event.type === 'output') next.activeOutput = event.content;
  }

  return next;
}

export function flushLiveEventState(state: LiveEventState): LiveEventState {
  return { ...state, backlog: 0 };
}
