---
type: semantic
tags: [architecture, scheduler, dag, concurrency]
created: 2026-07-22
related: [../codebase_insights/agent-runtime.md]
blast_radius: [src/agent/mission-planner.ts, src/agent/scheduler.ts, src/agent/task-executor.ts]
confidence: high
---

# ADR: DAG scheduler over a linear queue

- Status: Active
- Context: Missions contain milestones and tasks with prerequisites, while independent work should use available concurrency.
- Decision: Represent task dependencies explicitly and resolve them in the scheduler, with bounded parallel execution controlled by `MAX_CONCURRENT_TASKS`. Planner output also receives milestone fallbacks when dependencies are absent.
- Consequences: Planning, dependency resolution, and execution remain separate; task-title resolution and dependency tests are required. Circular dependencies must fail clearly instead of hanging.
- Evidence: `README.md` scheduler feature description; `src/agent/scheduler.ts`; `src/agent/mission-planner.ts`; `tests/scheduler-deps.test.mjs`; commits `ba7e7cd` and `7afd544`.
