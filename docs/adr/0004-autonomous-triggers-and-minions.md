# ADR 0004: Autonomous Triggers and Specialized Minions

- Status: Proposed
- Date: 2026-06-16
- Task: Integration of Loop Engineering Orange Book concepts

## Context

Following ADR 0003 (Loop Governor and Hard Evaluators), the `vibes` architecture has established strict execution boundaries and verifiable success criteria. However, the system still relies on monolithic execution (one general-purpose `executor` role) and manual human initiation (CLI commands).

The "Loop Engineering Orange Book" highlights two additional structural parts for robust agentic systems:
1. **The Trigger ("Observe" Move):** Autonomous systems must be capable of starting their own loops based on external events (e.g., test failures, file changes, issue tracking webhooks) rather than waiting for a human prompt.
2. **Helpers (Specialized Minions):** Relying on a single agent loaded with every possible tool and piece of context degrades performance (the "comprehension rot" problem). The system should spawn specialized, narrowly scoped sub-agents ("Minions") to handle specific tasks.

## Decision

We will implement an autonomous Trigger/Watcher system and a Fork-Join specialized Minion architecture.

### 1. Autonomous Triggers (`src/agent/triage-loop.ts` & `vibes watch`)
- Add a new CLI command: `vibes watch`.
- This command starts a daemon that monitors specific workspace triggers defined in `MEMORY.md` (e.g., watching `src/` for file saves, or polling a `.vibes/queue/` directory).
- When an event occurs (e.g., a file is saved and a local test runner outputs a failure log), the Trigger autonomously formats the "Observe" context and initiates the `mission-planner` without human intervention.

### 2. Specialized Minions (`src/agents/multi-agent.ts` Refactoring)
- Move away from the monolithic `executor` role.
- Implement a Fork-Join execution pattern (referencing `Fork-Join Multi-Agent Context Strategy for vibes.docx`).
- When the `mission-planner` creates a sub-task, it will spawn a **Specialized Minion** with a restricted toolset and prompt. Examples:
  - **Triage Minion:** Only has read access and grep/search tools to find the root cause of an error.
  - **Refactor Minion:** Only has access to AST parsers and `replace`/`write_file` tools.
  - **Test Minion:** Only has access to the test execution framework and test directories.

## Consequences

### Positive
- **Reduced Context Bloat:** Minions only receive the context and tools they need, reducing token usage and improving Gemma 12B's instruction-following accuracy.
- **True Autonomy:** The system can run in the background, actively fixing bugs as the developer saves files or as issues are assigned.
- **Modularity:** It is much easier to test and benchmark a narrow "Triage Minion" than a monolithic "do-everything" agent.

### Negative
- **Orchestration Complexity:** Managing state and context handoffs between the Planner, the specialized Minions, and the Governor requires robust state-machine logic.
- **Latency:** Spawning multiple sub-agents in a Fork-Join pattern introduces overhead compared to a single zero-shot monolithic run.

## Implementation Steps

1. Implement `src/agent/triage-loop.ts` with basic file-watching and log-tailing capabilities.
2. Register `vibes watch` as a top-level CLI command.
3. Update `src/agents/multi-agent.ts` to implement a minion factory, loading scoped toolsets dynamically via `plugin-loader.ts`.
4. Update the `mission-planner` to assign tool-scopes (Minion definitions) to the sub-tasks it generates.
