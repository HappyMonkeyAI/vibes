# TUI Reconstruction Telemetry & Worker Lanes — Design Plan

## Goal

Surface context reconstruction events and fork/join worker lanes in the TUI
without flooding the main Task View. Keep the live view readable while providing
enough signal for operators to understand what the system is doing.

## ExecutionEvent variants added (in `src/agent/types.ts`)

| Event | Purpose | Fields |
|---|---|---|
| `context_reconstructed` | Emitted when the reconstruction controller compacts context | `reason`, `tokensFreed`, `turnCount` |
| `lane_forked` | A parallel lane has been spawned | `laneId`, `taskId`, `title` |
| `lane_joined` | A parallel lane has completed and joined back | `laneId`, `taskId`, `title`, `result` ('success'\|'failure') |

## Rendering strategy

### Task View (live execution feed — `src/tui/components/task-view.tsx`)

All three event types render as **compact single-line entries** to avoid flooding:

- **`context_reconstructed`** — cyan `[Reconstruct]` label + reason + token stats on one line.
  Example: `[Reconstruct] Token budget exceeded (freed 12345 tok, kept 18 turns)`
  
- **`lane_forked`** — blue `[Fork]` label + lane ID + arrow + task title.
  Example: `[Fork] lane-abc → Refactor API handler`
  
- **`lane_joined`** — blue `[Join]` label + lane ID + result (green/red).
  Example: `[Join] lane-abc → Refactor API handler (success)`

These stay within the existing 15-event window (`events.slice(-15)`). When
multiple lanes are active simultaneously, each lane event appears in
chronological order interleaved with the primary task's execution feed.

### Dashboard (summary metrics — `src/tui/components/dashboard.tsx`)

The Dashboard component already renders context usage. A future enhancement
could add a small summary line:

```
[Context: 45% | Reconstructed: 3 times | Active lanes: 2]
```

This would be driven by derived state from the events array (counting
`context_reconstructed` and tracking open `lane_forked`/`lane_joined` pairs).

### Trace View (file-based persistence — `src/agent/trace.ts`)

The `TraceRecorder` already persists every `ExecutionEvent` as JSONL. No
code changes needed — new event variants are automatically recorded alongside
existing types. The `system_log` event type is also available for finer-grained
logging if the reconstruction controller or lane manager needs to emit
diagnostic information without affecting the live TUI feed.

### Log Stream View (`src/tui/components/log-stream-view.tsx`)

The Log Stream View currently shows `system_log` events. Future lane-related
diagnostics can use the `system_log` event type with level `INFO` or `DEBUG`
to surface detailed per-lane progress without polluting the Task View.

## Integration points for event emission

### Context reconstruction controller (`src/agent/context-reconstruction.ts`)

The `ReconstructionController.reconstruct()` method should accept an optional
`onEvent` callback. When reconstruction fires:

```typescript
onEvent?.({
  type: 'context_reconstructed',
  reason: 'Token budget exceeded',
  tokensFreed: reclaimedTokens,
  turnCount: verbatimPairs,
});
```

### Scheduler / TaskExecutor (fork/join lanes)

When `MAX_CONCURRENT_TASKS > 1` and a lane is created:

```typescript
onEvent?.({
  type: 'lane_forked',
  laneId: lane.id,
  taskId: task.id,
  title: task.title,
});
```

When a lane completes:

```typescript
onEvent?.({
  type: 'lane_joined',
  laneId: lane.id,
  taskId: task.id,
  result: task.status === 'done' ? 'success' : 'failure',
  title: task.title,
});
```

These integration points are **not implemented in task-009**. This document
describes the contract that task-006 (reconstruction controller) and task-007
(executor wiring) should follow.

## Anti-flooding rules

1. **Reconstruction coalescing**: If multiple reconstructions happen within
   5 seconds, only the last one is shown in the 15-event window slice.
   (Handled naturally by `events.slice(-15)` — old events fall off.)

2. **Lane event density**: Lane events are single-line. They do not carry
   full tool call traces. A dedicated lane inspector view (future TUI work)
   would provide per-lane drill-down.

3. **No modal/blocking**: Reconstruction and lane events never trigger
   `intervention_required`. They are informational only.

## Future considerations

- A dedicated **Lane Inspector** component (Alt+L or similar) could show a
  tabular view of active/completed lanes with per-lane summary data.
- Reconstruction frequency could be surfaced as a sparkline in the Dashboard.
- The `system_log` event could carry a `laneId` field for filtered log views.
