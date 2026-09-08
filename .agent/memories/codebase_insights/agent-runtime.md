---
type: semantic
tags: [typescript, agent-runtime, planner, scheduler, executor]
created: 2026-07-22
related: [../architectural_decisions/dag-scheduler.md, ../architectural_decisions/warm-interventions.md]
blast_radius: [src/agent/]
confidence: high
---

# Agent runtime boundaries

Vibes separates mission decomposition, dependency scheduling, and per-task execution. `src/agent/mission-planner.ts` creates mission structure and detects workspace technology; `src/agent/scheduler.ts` resolves `depends_on` and controls concurrent slots; `src/agent/task-executor.ts` performs the tool-calling loop, streaming, verification, and thrash handling.

The scheduler-to-executor boundary carries task metadata and runtime controls. Changes to task shape or execution hooks must be checked across planner output, scheduler propagation, executor invocation, and the corresponding `tests/` fixtures.

Evidence: `CONTEXT.md` file map; `.antigravity/memories/codebase_insights/agent_architecture.md`; recent commits `7afd544`, `ba379db`, and `70fe5b9`.
