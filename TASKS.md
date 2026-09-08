# Vibes Harness Recovery and Roadmap

Date: 2026-09-04

## Current status

The recent Vibes run used the prompt:

> Create a loading skeleton component with shimmer animation, variant shapes, and Suspense integration

Model:

- Executor: `qwythos-9b-claude-mythos-5-1m`

Run evidence:

- Workspace: `/home/stephen/test36`
- Mission: `cc79ed23-fa59-4bf2-bfc2-c068017c9337`
- Planned tasks: 4
- Attempts: 12
- Completed tasks: 1 of 4
- Scaffolding completed after retry
- `SkeletonCircle`: 4 failed attempts
- `SkeletonRect`: 3 failed attempts
- `SkeletonLine`: 3 failed attempts
- No advertised trace files were missing

The generated workspace could build, but the requested feature was incomplete:

- `App.tsx` remained `Hello, World!`
- Skeleton components were not integrated
- Suspense integration was absent
- `SkeletonRect` had no shimmer background
- Shimmer keyframes/styles were not reliably established

## What worked in the harness

- Scaffolding recovered successfully after retry.
- Retry state did not deadlock as in the earlier failure pattern.
- The run registry persisted all attempts.
- Per-attempt trace files were created.
- The previous shared temporary-file rename crash did not recur.
- Registry, retry, structural audit, trace, context, and stream tests are present.
- The final Vibes suite passes after the current fixes.

## What failed

### Model execution boundary

With a five-step budget, the 9B model spent turns rereading files, making speculative edits, and recovering from incorrect assumptions. It repeatedly:

- attempted unnecessary dependency installation;
- called directory tools on file paths and received `ENOTDIR`;
- referred to nonexistent entrypoints;
- emitted malformed fallback tool calls;
- produced invalid TypeScript/JSX;
- claimed verification without proving the requested feature was integrated.

### Reviewer scope

The reviewer correctly identified missing shimmer gradients and keyframes, but it also judged isolated shape tasks against the complete mission and required Suspense integration from a task that did not own it. Reviewer scope was too broad.

### Shared workspace verification

Multiple code tasks were allowed to run concurrently while each could inspect, review, and build the same mutable workspace. This creates a race where verification can observe sibling tasks halfway through writes.

### Trace observability

Tool calls, tool results, and executor errors were initially sent only to the live TUI. Durable traces contained model thinking/output but not the actionable tool timeline.

### Persistent configuration

The persisted config contained invisible control characters around model values. Runtime loading now strips them, but the persisted file should be normalized deliberately rather than silently assumed clean.

## Implemented harness improvements

### Durable trace lifecycle

Files:

- `src/agent/task-executor.ts`
- `src/agent/trace.ts`
- `tests/trace.test.mjs`

Changes:

- Tool calls, tool results, and executor errors now enter durable traces.
- `TraceRecorder.flush()` was added.
- The executor flushes queued trace writes before every return path.
- Regression tests cover tool lifecycle events.

### Workspace-safe scheduler concurrency

Files:

- `src/agent/scheduler-deps.ts`
- `src/agent/scheduler.ts`
- `tests/scheduler-deps.test.mjs`

Changes:

- When automated review is enabled, reviewed code tasks execute serially against the shared workspace.
- Non-code work still honors configured concurrency.
- This is a conservative safety policy until isolated worktree execution exists.

### Reviewer task scoping

Files:

- `src/agent/reviewer.ts`
- `tests/reviewer.test.mjs`

Changes:

- Reviewer prompt construction is testable.
- Reviewers are instructed to judge only the current task's acceptance criteria and concrete defects in changed files.
- Mission-wide integration is not required unless explicitly owned by the task.

### Small-model prompt profile

Files:

- `src/agent/model-prompts.ts`
- `tests/model-prompts.test.mjs`

Changes:

- 1B–12B models receive compact deterministic execution guidance.
- Qwythos 9B is covered.
- Gemma 12B retains its dedicated prompt profile.
- This is prompt-level only and does not silently override configured runtime limits.

### Configuration sanitization

File:

- `src/config.ts`

Changes:

- Persistent string settings strip invisible control characters before runtime schema validation.

## Verification already completed

From `/home/stephen/Vibes`:

- `npm run build` — passed
- focused scheduler tests — passed
- focused trace/task-executor tests — passed
- focused reviewer tests — passed
- focused model prompt tests — passed
- context reconstruction E2E — passed
- full `npm test` — passed, 115 tests
- `git diff --check` — passed

No commit or push has been made.

## Highest-priority roadmap

### Priority 0 — Clean reproduction gate

Run the exact skeleton prompt in a fresh workspace using:

- Qwythos 9B as executor;
- `MAX_CONCURRENT_TASKS=1`;
- at least 15–20 executor steps instead of 5;
- an independent stronger reviewer;
- Codex enabled;
- durable traces enabled.

Acceptance:

- no scheduler, persistence, or trace errors;
- no repeated unsupported tool calls;
- all requested files integrated into the real entrypoint;
- build/test evidence persisted;
- no task remains `todo`, `in_progress`, or `failed`.

This distinguishes remaining model limitations from harness defects.

### Priority 1 — Mission-level integration task

Status: [partial] `ensureIntegrationTask()` now reserves a final parent-owned integration task for multi-task missions and the planner invokes it. The scheduler now refuses completion when tasks remain incomplete, the integration task is absent/not done, or its evidence handoff lacks passing command/layer evidence. Independent adversarial review is still a separate gate.

Modify planning so cross-cutting requests produce a final integration task. For the skeleton request, the dependency shape should cover:

1. project/setup foundation;
2. shared shimmer styling/runtime;
3. base skeleton component;
4. shape variants;
5. Suspense wrapper;
6. demo/entrypoint integration;
7. final integration and verification.

The final task must own entrypoint imports, Suspense wiring, shared CSS/keyframes, and whole-feature verification.

Likely files:

- `src/agent/mission-planner.ts`
- planner tests

### Priority 2 — Mission-level completion gate

Status: [partial] The scheduler now rejects incomplete missions and requires a valid passing integration evidence handoff. Added a separate Owner-as-Adversary prompt/schema, runtime invocation behind the existing `ENABLE_ADVERSARIAL_AUDIT` flag, persistence, fail-closed review validation, and a guard rejecting identical/missing executor and reviewer model identities. Live adversarial acceptance remains.

Do not report mission success unless:

- no pending tasks;
- no failed tasks;
- a multi-file mission has an integration/final-verification task;
- build/test evidence exists and passes;
- changed files and the final result satisfy the original request.

Likely files:

- `src/agent/scheduler.ts`
- `src/agent/completion-receipt.ts`
- `src/agent/structural-audit.ts`
- scheduler/completion tests

### Priority 3 — Explicit small-model runtime profile

Add a visible/opt-in reliable small-model profile rather than silently changing user settings.

Suggested behavior:

- executor steps: 15–25;
- concurrency: 1 when review/build verification is active;
- compact context and memory injection;
- no repeated Codex retry storm after provider failure;
- clear model-role display in the TUI.

Likely files:

- `src/config.ts`
- `src/tui/components/settings-view.tsx`
- `src/agent/task-executor.ts`
- configuration/profile tests

### Priority 4 — Tool-drift/error feedback

Improve tool errors so they help the model recover:

- identify whether a path is a file or directory;
- suggest the valid next tool;
- include workspace-relative paths;
- stop repeated identical invalid calls earlier;
- avoid advertising unsupported tool names in fallback instructions.

Likely areas:

- `src/tools/`
- `src/agent/task-executor.ts`
- tool-loop tests

### Priority 5 — Planner task contracts

Strengthen post-plan validation:

- every user-requested capability appears in task titles or criteria;
- cross-cutting requests have shared-foundation tasks;
- multi-file plans have an integration task;
- task criteria do not leak ownership from sibling tasks;
- dependencies are acyclic and canonical;
- component implementation and whole-feature integration are separate tasks.

Important omissions should trigger a controlled planner retry or visible warning rather than being silently accepted.

### Priority 6 — Independent model-role validation

Recommended baseline:

- Planner: Phi-4 Mini or Qwen 27B;
- Executor: Qwythos 9B;
- Reviewer: Gemma 12B QAT or Qwen 27B;
- Triage: 2B observer only.

The TUI should show executor/reviewer models and whether review is independent or unverified.

### Priority 7 — Deterministic multi-file fixtures

Add local fixtures for:

- cross-cutting mission planning;
- final integration task generation;
- reviewer scope with sibling tasks;
- concurrent writes followed by serialized verification;
- malformed/unsupported tool calls;
- empty-content and reasoning-only provider responses;
- complete and incomplete mission receipts.

### Priority 8 — Roadmap and ADR refresh

The existing roadmap is stale:

- MCP client support appears unchecked although `src/mcp/mcp-service.ts` supports stdio/SSE loading and dynamic discovery;
- plugin support is implemented;
- reviewer/scheduler handshake work is partially implemented;
- sandbox work is duplicated across phases;
- ADR 0007 still says proposed even though much of it is implemented.

Update:

- `PLAN.md`
- `docs/adr/0007-durable-harness-evidence.md`
- `SMALL-MODEL-TESTING.md`

Use completed/partial/deferred/blocked status instead of stale checkboxes.

### Priority 9 — Sandbox and process lifecycle safety

After mission correctness is stable:

- shell process isolation;
- timeout and cancellation propagation;
- tracked child processes;
- zombie process cleanup;
- interrupted-mission cleanup verification;
- workspace boundary enforcement.

Likely files:

- `src/tools/shell-tool.ts`
- scheduler lifecycle code
- process/cleanup tests

### Priority 10 — Later roadmap items

Defer until the core harness completes missions reliably:

- automatic replanning when workspace state diverges;
- durable coder/reviewer actor model;
- shared swarm context/LTM synchronization;
- full Docker sandbox mode;
- job-board integrations;
- web dashboard;
- mobile/remote intervention.

## Protocol integration gate

Before implementing the next Vibes task, inspect the latest HappyMonkeyAI AgentsProtocol repository for:

- worktree isolation conventions;
- regression-testing and AI-myopia prevention workflows;
- worker/owner boundaries;
- state/ticket schemas;
- verification and handoff requirements;
- any new mandatory memory or protocol paths.

Do not copy protocol claims into Vibes without checking the actual repository files. Adapt only the smallest compatible subset to the existing TypeScript/Ink architecture.

Potential protocol-adoption order:

1. repository/worktree isolation for worker tasks;
2. regression fixture and anti-myopia gates;
3. durable task state and owner audit;
4. protocol documentation/ADR update;
5. only then resume mission-level integration and runtime-profile work.

## AgentsProtocol inspection — verified 2026-09-04

Source inspected directly from `https://github.com/HappyMonkeyAI/AgentsProtocol`:

- HEAD: `eb152f8bcc9522ae7814a254933abf9a9318109b`
- Relevant files: `docs/adr/0001-verification-ladder-and-owner-adversary.md`, `docs/adr/0002-isolated-worktrees-and-evidence-handoffs.md`, `skills/isolated-worktree-handoff/SKILL.md`, `skills/owner-adversary-verification/SKILL.md`, `BOOTSTRAP.md`.

### Protocol elements worth adapting

Implementation status: the first contract slice is complete and verified. Added `src/agent/protocol-contracts.ts`, `tests/protocol-contracts.test.mjs`, and scheduler injection of a bounded Worker Context Pack into task execution.

#### 1. Isolated worktree mode — ADR-0002

For parallel delegated implementation, the protocol defaults to one Git worktree per task:

```text
.worktrees/<task-id>
ag/<task-id>
```

Each Worker receives a context pack containing the absolute repository/worktree path, base ref, goal, dependencies, owned files, out-of-scope paths, verification commands, and constraints. Each Worker returns an evidence-bearing handoff containing status, branch/worktree, baseline, changed paths, exact commands/results, failures/skips, commit/push status, and verification layers.

The parent/Owner—not the Worker narrative or task-board status—performs final acceptance. Existing dirty paths must be recorded and preserved. `git add .`, reset/clean, and convenience stash operations are prohibited. Shared-checkout mode remains acceptable for solo Quick Mode or locked, non-overlapping work.

Vibes currently protects the shared workspace by serializing reviewed code tasks. Worktrees are the next step if parallel execution is re-enabled.

#### 2. Verification Ladder — ADR-0001

Non-trivial behavior changes use applicable stages:

- V0: deterministic touched-package tests, typecheck, and build;
- V1: Contract/Ripple blast-radius and schema/API/UI parity check;
- V2: independent Owner adversary tests derived from the spec/acceptance criteria, not Worker-authored tests;
- V3: bounded live/exploratory proof for UI/deployable runtime, including happy, invalid/destructive, empty/error, console, and state-readback checks;
- V4: feed failures back as fix tickets, rerun failed stages, and only then ratchet/mark done.

Worker self-report, green self-tests, and a Trident audit do not independently prove feature completion. Evidence layers must remain separate: unit, integration, E2E, and live.

#### 3. Anti-AI-myopia rule

The protocol identifies implementation myopia as the failure mode where a Worker builds the inferred happy path, writes matching tests, and declares success while peripheral wiring or edge states remain broken. The countermeasure is an independent Owner adversary that reads the SPEC/ADR and attempts to disprove each criterion, including missing UI, dead interactions, empty/error states, invalid input, partial wiring, and authorization gaps where relevant.

#### 4. Bootstrap/MCP discovery

`BOOTSTRAP.md` requires a portable documentation spine and a mounted-versus-wanted MCP inventory before deep mining. Vibes already has `AGENTS.md`, `CONTEXT.md`, ADRs, `.agent/memories/`, and MCP client code. `MCP.md` and a machine-local `MCP.local.md` are not currently present and should be considered a documentation follow-up, not copied blindly from the protocol.

### Protocol elements not to copy wholesale

- Automatic commit/rachet behavior conflicts with the current Vibes requirement to preserve user control and make no commit/push without approval.
- Pulse's hard reset behavior must never touch pre-existing human or sibling-agent changes; if adopted, it must be restricted to an agent-owned worktree.
- Full teamwork bootstrap and external MCP activation are not prerequisites for every Vibes mission.
- File-existence task-board checks are not verification evidence.
- The protocol's `agent/` branch interop should use Vibes' established `ag/` convention consistently.

### Resulting implementation order

1. [x] Add context-pack and evidence-handoff types at the Vibes scheduler/delegation boundary.
2. [partial] Add isolated worktree lifecycle for parallel code tasks, preserving dirty primary workspaces. Deterministic create/remove manager and path safety are implemented; scheduler task execution is not switched over yet.
3. Add a parent-owned V0–V2 completion gate and independent adversary brief.
4. Add bounded V3 browser/runtime verification when the target has a UI/runtime surface.
5. Add regression fixtures proving the ladder rejects incomplete integration and Worker-only claims.
6. Then implement planner integration-task generation and the small-model runtime profile.