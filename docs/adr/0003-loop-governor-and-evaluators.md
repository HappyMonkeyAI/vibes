# ADR 0003: Autonomous Loop Governor and Hard Evaluators

- Status: Proposed
- Date: 2026-06-16
- Task: Integration of Loop Engineering Orange Book concepts

## Context

As the `vibes` architecture evolves toward autonomous, multi-turn execution (moving from a human-driven "Harness" to an autonomous "Loop"), the system faces two critical risks:
1. **Runaway Loops:** Without human intervention, an agent stuck in a hallucination cycle or an unresolvable error state can rapidly consume token budgets and compute resources.
2. **False Positives in Verification:** The current `goal-judge.ts` relies primarily on LLM evaluation ("AI grading its own homework"). This soft evaluation often leads to agents declaring success on code that does not compile or pass tests.

The "Loop Engineering Orange Book" formalizes the necessity of two specific architectural components to solve these issues:
- **The Governor:** A strict safety and cost-control layer.
- **The Evaluator:** A verification system that prioritizes "hard" external checks (compilers, linters) over LLM opinions.

## Decision

We will introduce a strict Governor service and refactor the Goal Judge to enforce Hard Evaluators.

### 1. The Governor Service (`src/agent/governor.ts`)

We will implement a Governor service that wraps the `task-executor.ts` and `scheduler.ts` loops. The Governor will enforce the following hard constraints:
- **Max Turns:** A hard limit on the number of execution cycles a task can take before forced termination or escalation.
- **Token Budgets:** Hard limits on context window size and total tokens consumed per mission/task.
- **Circuit Breakers (Stuck Loop Detection):** The Governor will analyze the `TraceRecorder` stream. If it detects identical tool calls failing consecutively, or identical code being written without progressing, it will break the loop and trigger an intervention.

### 2. Hard Evaluators (`src/agent/goal-judge.ts` Refactoring)

We will refactor the `goal-judge.ts` to mandate external validation before LLM evaluation.
- **Pre-Flight Checks:** Before an LLM is asked "Did you accomplish the goal?", the system must execute project-specific build/test commands (e.g., `tsc`, `npm run lint`, `cargo check`).
- **Failure Short-Circuit:** If the hard evaluator returns a non-zero exit code, the `goal-judge` immediately fails the task and feeds the compiler/linter error back into the loop as the next `Observe`/`Orient` move.
- The LLM judge is only utilized if all hard evaluators pass, verifying semantic intent rather than structural correctness.

## Consequences

### Positive
- **Cost Control:** Prevents expensive infinite loops and token runaway, making autonomous mode (YOLO) safe to operate.
- **Reliability:** Guarantees that code produced by `vibes` is structurally sound and compiles, dramatically reducing "hallucinated success."
- **Autonomy:** Provides the necessary safety nets to allow `vibes` to operate asynchronously via triggers (e.g., webhooks or file watchers) without constant human supervision.

### Negative
- **Friction:** Tasks may fail more often initially because the success criteria are significantly stricter.
- **Configuration Overhead:** Requires the user (or the system via `MEMORY.md`) to correctly define the "Hard Evaluator" commands (e.g., knowing that a project uses `npm run test` vs `yarn test`).

## Implementation Steps

1. Create `src/agent/governor.ts` with thresholds for turns, tokens, and repeated failures.
2. Inject the Governor into the main loop in `src/agent/scheduler.ts`.
3. Update `src/agent/goal-judge.ts` to accept and execute shell commands (`run_shell_command` equivalent) as a prerequisite to LLM evaluation.
4. Update `MEMORY.md` initialization to attempt to auto-detect the project's build/test commands.
