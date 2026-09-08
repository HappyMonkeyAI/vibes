---
type: procedural
tags: [patterns, lessons, verification, small-models, typescript]
created: 2026-07-22
related: [codebase_insights/agent-runtime.md, codebase_insights/context-and-memory.md]
blast_radius: [src/agent/, src/memory/, src/tui/]
confidence: high
---

# Patterns and lessons

## Success patterns

- Keep planner, scheduler, and executor responsibilities separate; propagate task metadata explicitly across those boundaries.
- Use a scheduler-owned Promise plus a stable UI ref for human interventions; do not attempt to resume agent execution through React state alone.
- Bound memory injection before system-prompt construction. Entry counts alone do not bound token usage.
- Prefer OpenAI-compatible model discovery and transports so Ollama, LM Studio, and vLLM remain interchangeable.
- Treat compiler/build verification as part of task completion. `npm run build` is the repository's TypeScript gate.

## Failure lessons

- Repeated failing tool sequences can be legitimate verification or convergence. Thrash detection must distinguish repeated failures from read-only inspection and explicit build/test checks.
- High-frequency session reads and writes can exhaust the JS heap even when individual payloads are small. Serialize writes and persist only milestone events.
- Configuration schemas that transform environment and JSON values twice can fail at runtime. Merged inputs need schemas that accept both raw and already-transformed representations.
- Generic global keys and unguarded Ink input handlers leak into text fields. Guard shortcuts and preserve input-local navigation.

Evidence: `.antigravity/memories/patterns_and_lessons.md`; `AGENTS.md`; commits `70fe5b9`, `4590c37`, `253649f`, and `5d83be1`.
