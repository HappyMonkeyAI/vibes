---
type: semantic
tags: [memory, context, compaction, jsonl, local-first]
created: 2026-07-22
related: [../architectural_decisions/local-jsonl-memory.md]
blast_radius: [src/memory/, src/agent/context-manager.ts, src/agent/context-reconstruction.ts]
confidence: high
---

# Context and memory pipeline

The primary persistent memory path is local JSONL, exposed through `src/memory/memory-service.ts`; Mem0 is optional. Context pressure is handled by `src/agent/context-manager.ts` and `src/agent/context-reconstruction.ts`, which compact messages and rehydrate grounded state from project files rather than relying on an unbounded conversation buffer.

Memory injection must remain token-budgeted before prompt construction. This protects small local models because content embedded in the system prompt is not reliably recoverable by later executor compaction.

Evidence: `CONTEXT.md` memory architecture; `.antigravity/memories/architectural_decisions/token_and_context_optimization.md`; recent fixes recorded in `.antigravity/memories/patterns_and_lessons.md` under token-budgeted injection and heap/OOM mitigation.
