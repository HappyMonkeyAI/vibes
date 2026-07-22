---
type: semantic
tags: [architecture, memory, jsonl, local-first, mem0]
created: 2026-07-22
related: [../codebase_insights/context-and-memory.md]
blast_radius: [src/memory/, src/config.ts]
confidence: high
---

# ADR: Local JSONL memory as the primary store

- Status: Active
- Context: Vibes targets local and small-model workflows and must retain useful memory without requiring a remote service.
- Decision: Use local JSONL persistence as the default memory store; treat Mem0 as an optional remote peer integration.
- Consequences: Startup and writes must remain resilient to missing or corrupted local state, and memory retrieval must be bounded before prompt injection. Remote-memory failures must not prevent local operation.
- Evidence: `README.md` memory feature and installation notes; `src/memory/memory-service.ts`; `src/memory/local-memory.ts`; `CONTEXT.md` memory architecture.
