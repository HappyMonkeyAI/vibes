# Vibes Harness and TUI Improvements Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Vibes a more observable, durable, evidence-driven local coding harness while preserving its TypeScript/Ink/local-LLM architecture.

**Architecture:** Extend the existing planner → scheduler → executor → reviewer pipeline with a typed execution envelope, true model-stream delta events, scheduler-owned durable checkpoints, and deterministic completion/evaluation receipts. Keep the current `ExecutionEvent` consumers compatible during migration. Improve the TUI through selective state updates, bounded rendering, worker identity/transcripts, and capture/benchmark fixtures rather than importing a web UI or another agent runtime.

**Tech Stack:** TypeScript ESM, Node >=22, Ink 6, React 19, OpenAI-compatible SDK, Zod, Node built-in test runner, existing JSONL/session/trace persistence.

---

## Source-backed design inputs

- Lilian Weng, “Harness Engineering for Self-Improvement”:
  https://lilianweng.github.io/posts/2026-07-04-harness/
  - plan → execute → observe/test → improve loop
  - filesystem-backed artifacts
  - explicit inspectable subagent/backend jobs
  - itemized ACE-style context instead of opaque prompt rewrites
- brainless capture-first TUI components:
  https://github.com/theswerd/brainless
- Hermes Agent v0.19.0 Quicksilver release:
  https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.20
  - incremental streaming, bounded rerenders, durable worker transcripts, smart approvals, benchmark harness
- Groundtruth deterministic completion receipts:
  https://github.com/akahkhanna/groundtruth
- argot repository-history-aware local audits:
  https://github.com/get-tmonier/argot
- OpenWOP durable/replayable workflow envelopes:
  https://github.com/openwop/openwop
- Qwen Code:
  https://github.com/QwenLM/qwen-code
  - Node >=22 TypeScript agent, auto-memory/skills, subagents/teams, hooks, worktrees, session management, SDK/headless mode, daemon/ACP mode, Agent Arena

Qwen Code findings worth adapting:

- `packages/core/src/agents/runtime/workflow-journal.ts` and `workflow-snapshot.ts`: durable workflow journal/snapshots.
- `packages/core/src/agents/workflow-run-registry.ts`: explicit run identity and lifecycle.
- `packages/core/src/agents/background-agent-resume.ts` and `background-tasks.ts`: restartable background-agent roster.
- `packages/core/src/agents/team/identity.ts`, `mailbox.ts`, and `team-events.ts`: worker identity and structured coordination.
- `packages/core/src/hooks/`: composable hooks and permission boundaries.
- `packages/core/src/agents/arena/`: same-task multi-model comparison, useful later as an evaluation mode.
- `.qwen/skills/agent-reproduce-align/`: tmux capture and trace-normalization workflow, useful for Vibes TUI regression evidence.
- `packages/sdk-typescript/`: headless streaming query API, useful as a future Vibes SDK surface.

Do not copy Qwen’s full CLI, daemon, channel, desktop, or provider surface into Vibes. Do not add a runtime dependency on any external project in this plan.

---

## Phase 0 — Freeze current state and add explicit contracts

### Task 0.1: Add an implementation ADR and acceptance matrix

**Objective:** Record the adopted boundaries before code changes.

**Files:**
- Create: `docs/adr/0007-durable-harness-evidence.md`
- Modify: `.agent/memories/architectural_decisions/` only if the implementation establishes a new durable decision

**Acceptance:** ADR states that Vibes adopts typed envelopes, deterministic receipts, workspace-scoped traces, and append/checkpoint durability; explicitly rejects importing Qwen/OpenWOP wholesale.

**Verify:** Read the ADR and run `git diff --check`.

### Task 0.2: Establish a focused test map

**Objective:** Identify existing tests and create a temporary baseline report before implementation.

**Files:**
- Create: `tests/harness-plan.test.mjs` only if a stable pure helper needs a new test module
- Inspect: `tests/`, `package.json`

**Verify:** `npm run build` and the relevant existing test commands pass before Phase 1.

---

## Phase 1 — Typed execution envelopes and durable trace correctness

### Task 1.1: Add envelope types and compatibility helpers

**Objective:** Give every durable execution event a run/task/attempt/sequence identity without breaking existing event consumers.

**Files:**
- Modify: `src/agent/types.ts`
- Test: `tests/execution-envelope.test.mjs`

**Design:** Add `ExecutionEnvelope` with `runId`, `missionId`, optional `taskId`, `attempt`, monotonic `sequence`, ISO timestamp, actor/worker identity, and existing event payload. Add a helper to wrap legacy `ExecutionEvent` values at the executor boundary.

**Verify:** Unit tests assert stable sequencing, JSON serialisation, and legacy event compatibility.

### Task 1.2: Make trace recording workspace-scoped and serialized

**Objective:** Ensure traces land in the mission workspace and survive concurrent event writes in order.

**Files:**
- Modify: `src/agent/trace.ts`
- Modify: `src/agent/task-executor.ts`
- Test: `tests/trace.test.mjs`

**Design:** Pass `workspaceRoot`, run ID, mission ID, and attempt to `createTraceRecorder`. Add a per-file Promise write queue, sequence numbers, and a non-silent diagnostic counter. Preserve JSONL and tolerate a truncated final line during recovery.

**Verify:** Temporary-workspace test confirms path, ordering, parseability, and a second reader can replay the trace.

### Task 1.3: Add deterministic completion receipts

**Objective:** Prevent false “done” claims using Groundtruth’s declare-then-verify pattern.

**Files:**
- Create: `src/agent/completion-receipt.ts`
- Modify: `src/agent/types.ts`
- Modify: `src/agent/goal-judge.ts`
- Modify: `src/agent/reviewer.ts`
- Test: `tests/completion-receipt.test.mjs`

**Design:** Define receipts for changed files, symbols, verification commands/results, deferred items, reviewer outcome, and status (`complete|partial|blocked`). Verify file claims against Git diff and verification claims against captured exit codes. Reviewer failure must become `unverified`/rejected, never an automatic approval.

**Verify:** Tests cover missing claims, claimed-but-absent files, failed commands, deferred work, and a valid receipt.

---

## Phase 2 — Scheduler-owned durability and restart recovery

### Task 2.1: Add scheduler persistence callbacks

**Objective:** Persist state at the mutation boundary, not only from the React bridge.

**Files:**
- Modify: `src/agent/scheduler.ts`
- Modify: `src/tui/hooks/use-mission.ts`
- Modify: `src/agent/session-service.ts`
- Test: `tests/scheduler-persistence.test.mjs`

**Design:** Inject a persistence callback/service into `Scheduler`; persist after task start, completion, failure, retry, and intervention resolution. Keep atomic temp-file rename and per-mission write queues.

**Verify:** Simulated scheduler interruption leaves a readable session with the latest task status and envelope sequence.

### Task 2.2: Add append-only event recovery and session summaries

**Objective:** Avoid rewriting full event arrays and parsing every full session during history display.

**Files:**
- Modify: `src/agent/session-service.ts`
- Create: `src/agent/session-index.ts`
- Test: `tests/session-recovery.test.mjs`

**Design:** Use append-only session events plus periodic compact snapshots; repair an incomplete final JSONL line; maintain lightweight session metadata (`id`, title, status, updatedAt, counts, workspace). Keep existing session JSON readable during migration.

**Verify:** Test crash-tail repair, snapshot compaction, pagination/summary loading, and migration from current session files.

### Task 2.3: Add explicit worker/run registry

**Objective:** Make concurrent task identity and lifecycle inspectable, adapting Qwen’s workflow run registry/background roster concepts.

**Files:**
- Create: `src/agent/run-registry.ts`
- Modify: `src/agent/scheduler.ts`
- Modify: `src/agent/types.ts`
- Test: `tests/run-registry.test.mjs`

**Design:** Track `queued|running|completed|failed|cancelled|stale`, task identity, attempt, start/end times, current tool, last event, and transcript path. Keep it in-process first; persist status through the session/event layer.

**Verify:** Tests cover concurrent registration, completion, failure, cancellation, and stale recovery.

---

## Phase 3 — True streaming and selective TUI updates

### Task 3.1: Add a streaming response adapter

**Objective:** Emit model deltas instead of waiting for complete responses.

**Files:**
- Create: `src/agent/stream-adapter.ts`
- Modify: `src/agent/task-executor.ts`
- Modify: `src/agent/types.ts`
- Test: `tests/stream-adapter.test.mjs`

**Design:** Support OpenAI-compatible streamed chunks; normalise reasoning/content deltas; retain non-streaming fallback for providers that do not support streaming. Accumulate the active block outside React state and emit typed delta events plus a final immutable event.

**Verify:** Fixture stream tests cover content, reasoning, tool-call arguments, empty chunks, provider fallback, and stream errors.

### Task 3.2: Split live deltas from durable completed events

**Objective:** Prevent full-history rerenders while preserving complete trace evidence.

**Files:**
- Modify: `src/tui/hooks/use-mission.ts`
- Modify: `src/tui/components/task-view.tsx`
- Modify: `src/tui/components/trace-view.tsx`
- Test: `tests/streaming-view-model.test.mjs`

**Design:** Maintain a bounded immutable event list, an active delta buffer, derived task counters, and event backlog metrics. Flush active deltas at a controlled cadence; dashboard state updates only on task/governor/context transitions.

**Verify:** Pure view-model tests assert delta coalescing, event caps, follow/unfollow, and no mutation of completed events.

### Task 3.3: Move diff acquisition out of render

**Objective:** Prevent synchronous Git work and O(diff-lines × issues) scans during Ink render.

**Files:**
- Modify: `src/tui/components/diff-view.tsx`
- Create: `src/tui/hooks/use-diff-model.ts`
- Test: `tests/diff-model.test.mjs`

**Design:** Cache `git diff HEAD` by workspace/revision, parse once, index review/audit issues by file/line, and render only a viewport-sized row window. Preserve current bounded tail behavior as fallback.

**Verify:** Tests cover empty/large diffs, changed revision invalidation, issue lookup, and render-row bounds.

---

## Phase 4 — Worker transcripts, approvals, and capture evidence

### Task 4.1: Add durable per-worker transcripts

**Objective:** Make Qwen/Hermes-style background workers visible and restart-inspectable.

**Files:**
- Modify: `src/agent/run-registry.ts`
- Modify: `src/agent/trace.ts`
- Modify: `src/tui/components/dashboard.tsx`
- Modify: `src/tui/components/task-view.tsx`
- Test: `tests/worker-transcript.test.mjs`

**Design:** Store per-task transcript paths and live status; expose selected-worker summaries with current tool, duration, last output, and failure reason. Keep complete transcripts on disk and bounded display state in memory.

**Verify:** Start two fake workers, stream events, reload the registry/session, and confirm both workers remain distinguishable.

### Task 4.2: Add command-level approval policy

**Objective:** Adapt Qwen’s permission modes and Hermes’ smart-approval/deny-reason concepts without weakening Vibes safety defaults.

**Files:**
- Create: `src/agent/approval-policy.ts`
- Modify: `src/agent/task-executor.ts`
- Modify: `src/config.ts`
- Modify: `src/tui/components/intervention-view.tsx`
- Test: `tests/approval-policy.test.mjs`

**Design:** Classify exact tool invocations; support `default`, `plan`, `auto-edit`, and `yolo` modes only where existing safety rules allow. Add Allow Once, Deny with Reason, and optional exact-pattern deny rules. Feed denial reasons back into the next agent turn and persist an audit receipt.

**Verify:** Tests prove unsafe commands cannot be auto-approved by a broad pattern, denial feedback reaches the executor, and YOLO does not bypass explicit deny rules.

### Task 4.3: Add tmux/ANSI capture fixtures

**Objective:** Adapt Qwen’s reproduce-align capture workflow and brainless’s capture-first fidelity testing.

**Files:**
- Create: `tests/fixtures/tui/*.ansi`
- Create: `tests/tui-capture.test.mjs`
- Create: `scripts/capture-tui.sh`
- Modify: `package.json`

**Design:** Capture deterministic scenarios for planning, streaming, tool call/result, approval, intervention, diff, and completion. Normalise volatile timestamps/ANSI noise and assert labels, shortcuts, truncation, and bounded output.

**Verify:** `npm run test:tui-capture` passes in a PTY-capable environment; if unavailable, run the normalised fixture tests and report the environment limitation.

---

## Phase 5 — Structured memory and repository-aware audits

### Task 5.1: Add progressive-disclosure structured memory items

**Objective:** Adapt ACE and research-skill progressive disclosure to `.agent/memories/` without invalidating existing memory.

**Files:**
- Modify: `src/memory/local-memory.ts`
- Modify: `src/memory/memory-service.ts`
- Modify: `src/agent/context-reconstruction.ts`
- Create: `src/memory/memory-item.ts`
- Test: `tests/memory-items.test.mjs`

**Design:** Add stable ID, summary, source, confidence, status, supersedes, task/run ID, and full content fields. Retrieve index/summary first, then bounded full content. Preserve legacy free-form JSONL reads and migrate only on write.

**Verify:** Tests cover legacy reads, deduplication, supersession, confidence filtering, token budgets, and reconstruction provenance.

### Task 5.2: Add repository-history audit

**Objective:** Add an optional deterministic audit inspired by argot.

**Files:**
- Create: `src/agent/repository-audit.ts`
- Modify: `src/agent/structural-audit.ts`
- Modify: `src/agent/goal-judge.ts`
- Test: `tests/repository-audit.test.mjs`

**Design:** Start with low-risk checks: deleted/modified tests, new package dependencies, known layering violations, and configured superseded APIs. Use Git history as evidence and return warnings, not blockers, until calibrated.

**Verify:** Fixture repositories test each detector and ensure unrelated history does not generate findings.

---

## Phase 6 — Evaluation, benchmark, and optional multi-model arena

### Task 6.1: Add acceptance/evidence benchmark harness

**Objective:** Measure the harness rather than relying on subjective TUI impressions.

**Files:**
- Create: `scripts/bench-harness.mjs`
- Create: `tests/fixtures/benchmarks/*.json`
- Modify: `package.json`
- Create: `research/notes/2026-07-22-vibes-harness-baseline.md`

**Metrics:** cold start, first thinking delta, first output delta, total stream latency, event backlog, diff parse/render latency, session load latency, completion-receipt accuracy, false-done rate.

**Verify:** `npm run bench:harness -- --json` emits machine-readable results and the baseline note records the actual output and environment.

### Task 6.2: Add optional Agent Arena mode

**Objective:** Adapt Qwen’s same-task multi-model comparison only after receipts and benchmarks exist.

**Files:**
- Create: `src/agent/arena/arena-runner.ts`
- Create: `src/agent/arena/arena-types.ts`
- Modify: `src/agent/scheduler.ts`
- Modify: `src/tui/components/review-view.tsx` or existing review surface
- Test: `tests/arena-runner.test.mjs`

**Design:** Run the same bounded task against selected configured models/worktrees, collect completion receipts and evaluator results, and compare deterministic evidence. No automatic winner selection without explicit user action.

**Verify:** Fake-provider tests cover isolation, budget limits, receipt comparison, cancellation, and incomplete runs.

### Task 6.3: Future SDK/headless surface (deferred)

**Objective:** Record, but do not implement until the core run envelope stabilises, a Qwen-style async iterable SDK/headless mode for embedding Vibes.

**Files:**
- Future: `src/sdk/`
- Future: `docs/adr/`

**Gate:** Only begin after Phases 1–6 have a stable envelope and benchmark baseline.

---

## Verification gates

After every task:

```bash
npm run build
```

Relevant focused commands as they are added:

```bash
node --test tests/execution-envelope.test.mjs tests/trace.test.mjs
node --test tests/completion-receipt.test.mjs tests/scheduler-persistence.test.mjs
node --test tests/stream-adapter.test.mjs tests/streaming-view-model.test.mjs
node --test tests/diff-model.test.mjs tests/worker-transcript.test.mjs
node --test tests/approval-policy.test.mjs tests/memory-items.test.mjs
npm run test:tui-capture
npm run bench:harness -- --json
```

Final gates:

- `npm run build`
- all focused tests
- `git diff --check`
- no new `src/**/*.js`
- no secrets in `.vibes/mcp.json`
- keyboard shortcuts remain guarded in `useInput`
- workspace-root isolation verified for traces, sessions, and workers
- existing `.antigravity/memories/` remains untouched
- new durable decisions/lessons added to `.agent/memories/` only after implementation evidence exists

## Risks and explicit non-goals

- Do not import OpenWOP, Qwen Code, Hermes, argot, or Groundtruth as runtime frameworks.
- Do not enable smart approval by default before deterministic deny/allow tests pass.
- Do not increase concurrency before worker identity, trace ordering, and workspace isolation are reliable.
- Do not let streamed deltas become the durable source of truth; completed envelopes and receipts remain authoritative.
- Do not rewrite all existing memory/session formats in one migration.
- Do not implement daemon/ACP/IM channels/desktop support in this plan.
- Do not commit or push as part of planning.
