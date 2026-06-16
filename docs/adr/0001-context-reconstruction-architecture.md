# ADR 0001: Client-Owned Context Reconstruction Architecture

- Status: Accepted for prototype
- Date: 2026-06-16
- Task: task-001

## Context

Vibes currently has research notes for a major context-management upgrade. The core recurring problem is that long-running agent loops accumulate terminal output, failed attempts, tool results, and stale conversation turns until useful state is buried or compacted unsafely.

The research imported from `gdrive/` points toward the same design direction:

- keep durable workflow state separate from recent raw execution history;
- preserve exact file paths, line numbers, command failures, and error headers;
- use deterministic transforms before any model-written summaries;
- reconstruct context from client-owned state instead of relying on backend auto-compaction;
- validate completion with an out-of-band goal check.

Several external-product claims in the research still need primary-source verification. This ADR therefore decides the internal Vibes architecture shape, not the truth of those product claims.

## Decision

Vibes will prototype a client-owned context reconstruction system behind a feature flag.

The architecture has five parts:

1. Four-layer state model
   - `MEMORY.md`: durable project rules, stack assumptions, workspace constraints.
   - `checkpoint.md`: latest verified execution state, environment changes, dirty files, and recovery anchors.
   - `notes.md`: bounded scratch/discovery notes for the active run.
   - `progress.md`: tree of current goals, completed micro-objectives, blockers, and remaining work.

2. Local context index
   - Store historical session chunks in a local append-only index.
   - Prefer SQLite FTS5 if available.
   - Provide a safe no-op or JSONL fallback if SQLite support is unavailable.
   - The index is retrieval support, not the source of truth for active execution.

3. Deterministic transform pipeline
   - Apply local transforms to tool output before it is reintroduced into model context.
   - Collapse repeated build/log noise.
   - Trim stack traces while preserving the error message and application frames.
   - Mask low-signal output blocks rather than paraphrasing them.
   - Preserve paths, line numbers, command names, exit codes, and error headers verbatim.

4. Reconstruction controller
   - Monitor token/message pressure.
   - On threshold, capture state, dump history to the local index, clear old active message arrays, and rebuild a lean prompt from:
     - system/developer rules;
     - `MEMORY.md`;
     - latest checkpoint;
     - current progress;
     - a small number of recent verbatim interaction pairs.
   - Default runtime behavior remains unchanged unless the feature flag is enabled.

5. `/goal` validation hook
   - Add a deterministic hook surface for objective validation before a task can be treated as complete.
   - The first implementation should not require an external judge model.
   - Later implementations may optionally delegate review to another model or worker.

## Consequences

Positive:

- Vibes owns its token lifecycle instead of depending on vendor auto-compaction.
- Long-running local-model sessions can recover context without dragging full terminal history forward.
- The design gives multi-agent workers separate implementation seams: schemas, index, transforms, controller, TaskExecutor integration, TUI telemetry, docs, and tests.
- Feature-flagging keeps current users safe while the upgrade is validated.

Tradeoffs:

- More moving parts: state files, index, reconstruction controller, and validation hook.
- Incorrect state extraction can be worse than simple recency if it drops unresolved constraints.
- SQLite availability and packaging need careful handling for npm distribution.
- TUI telemetry must avoid reintroducing the same log-noise problem visually.

## Implementation rules

- Keep the prototype feature-flagged and default-off.
- Do not change scheduler semantics in the first integration pass.
- Do not summarize source facts in ways that can destroy actionable details.
- Do not cite unverified competitor/research claims as factual product behavior in user-facing docs.
- Every implementation task must run `npm run build`; focused tests should be added per module.

## Follow-up tasks

- task-002 audits current extension points.
- task-003 defines schemas.
- task-004 prototypes the local context index.
- task-005 implements deterministic transforms.
- task-006 adds the reconstruction controller.
- task-007 wires the feature flag into `TaskExecutor`.
- task-008 adds the `/goal` hook.
- task-009 designs TUI telemetry.
- task-010 documents operation.
- task-011 validates end-to-end behavior.
- task-012 verifies research claims against primary sources.
