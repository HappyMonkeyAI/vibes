# ADR 0007: Durable Harness Evidence

- Status: Proposed for implementation
- Date: 2026-07-22

## Context

Vibes already has a planner, DAG scheduler, task executor, reviewer, context reconstruction, sessions, and traces. Several boundaries are only partially durable: execution state is persisted from the TUI bridge rather than at scheduler mutation points; streamed model output is not exposed incrementally; and completion claims are not independently represented as deterministic evidence.

Recent harness work in Hermes Agent, Qwen Code, Groundtruth, OpenWOP, and related projects converges on explicit run identity, durable journals/snapshots, inspectable worker state, bounded rendering, and evidence-backed completion. Vibes must adopt those ideas without importing another agent framework or changing its local-first TypeScript/Ink architecture.

## Decision

Vibes will evolve around four compatible contracts:

1. **Typed execution envelopes** — durable events carry run, mission, task, attempt, sequence, timestamp, and actor identity.
2. **Workspace-scoped durable traces and checkpoints** — traces and session recovery artifacts are written below the mission workspace, serialized per run, and recoverable after interruption.
3. **Deterministic completion receipts** — an agent's completion claim is checked against Git changes and captured verification evidence; model reviewers cannot silently convert an unavailable review into approval.
4. **Bounded observation** — live streaming state is separate from immutable completed events; TUI views render bounded, derived state rather than reprocessing full histories on every update.

Existing `ExecutionEvent`, session JSON, JSONL memory, and TUI consumers remain readable during migration. New external protocols, daemon/ACP channels, IM integrations, and desktop surfaces are explicitly out of scope.

## Consequences

- Scheduler and executor APIs gain explicit lifecycle/evidence seams.
- Trace and session files gain metadata and recovery rules; legacy files require tolerant readers.
- Tests must cover ordering, retries, truncation, crash recovery, false completion, and workspace isolation.
- Streaming improves perceived latency but must not become the authoritative durable record.
- Concurrency will not be expanded until worker identity, trace ordering, and workspace isolation are verified.
- Smart approval remains opt-in until exact-command policy and deny-reason tests pass.

## Evidence

- `src/agent/scheduler.ts`
- `src/agent/task-executor.ts`
- `src/agent/session-service.ts`
- `src/agent/trace.ts`
- `src/agent/types.ts`
- `src/tui/hooks/use-mission.ts`
- `https://lilianweng.github.io/posts/2026-07-04-harness/`
- `https://github.com/NousResearch/hermes-agent/releases/tag/v2026.7.20`
- `https://github.com/QwenLM/qwen-code`
- `https://github.com/akahkhanna/groundtruth`
- `https://github.com/openwop/openwop`
