---
type: semantic
tags: [architecture, interventions, scheduler, human-in-the-loop]
created: 2026-07-22
related: [../codebase_insights/agent-runtime.md]
blast_radius: [src/agent/scheduler.ts, src/tui/hooks/use-mission.ts, src/tui/]
confidence: high
---

# ADR: Promise-blocking interventions

- Status: Active
- Context: A task may need user approval or guidance while its execution history must remain live.
- Decision: Park the running task on a scheduler-owned Promise and resolve it through the TUI's stable scheduler reference.
- Consequences: Human input resumes the same execution path with warm message history. React state remains presentation state, not the synchronization mechanism for the agent loop. Intervention behavior must be tested at the scheduler/UI bridge boundary.
- Evidence: `.antigravity/memories/codebase_insights/scheduler_and_interventions.md`; `src/agent/scheduler.ts`; `src/tui/hooks/use-mission.ts`; `docs/adr/0003-loop-governor-and-evaluators.md`.
