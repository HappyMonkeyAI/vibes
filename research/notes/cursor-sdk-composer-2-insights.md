---
type: research-note
tags: [vibes, cursor, composer, context, tools]
created: 2026-06-16
source: "Cursor SDK & Composer 2 Insights for vibes"
status: imported-from-google-drive-export
---

# Cursor SDK & Composer 2 Insights for vibes

## Source
- Google Drive export: `gdrive/Cursor SDK & Composer 2 Insights for vibes.docx`
- Google Drive document name: `Cursor SDK & Composer 2 Insights for vibes`
- Local transcript: `gemini_chat.txt`
- Transcript anchor: gemini_chat.txt lines 107-194
- Calendar review block: Tue, Jun 16 2026, 13:00-14:00
- Referenced links:
  - https://cursor.com/get-started

## Summary
Cursor/Composer patterns suggest moving beyond harness-owned generic summarization toward model-aware self-summarization, verbatim deletion, and dynamic tool-schema discovery.

## Key takeaways
- Self-summarization can let the active model decide what it needs to preserve for the current task.
- Verbatim deletion is safer than lossy rewriting for file paths, line numbers, and terminal errors.
- Dynamic tool discovery can reduce prompt bloat by exposing tool names first and schemas only on demand.

## Vibes implementation implications
- Prototype compaction modes that preserve exact file paths/errors or delete blocks entirely, avoiding paraphrased source facts.
- Move large MCP/tool schemas behind an on-demand lookup layer where feasible.
- If testing self-summarization, compare it against deterministic state extraction and include regression cases for path/line preservation.

## Caveats / verification needed
- Imported from gemini_chat.txt / user-provided Drive document names; claims should be verified against primary sources before implementation decisions.

## Follow-up questions
- Which ideas should become ADRs versus experiments?
- Which claims require direct source validation before coding?

## Full Google Drive export

_Source file: `gdrive/Cursor SDK & Composer 2 Insights for vibes.docx`_

# Architectural Insights from Cursor SDK & Composer 2 for vibes

This document synthesizes key architectural strategies from Cursor's
programmatic agent infrastructure and Composer 2 updates, mapping out
how these patterns can be adapted to optimize context efficiency in the
vibes TUI developer harness.

## 1. Self-Summarization via Model Scratchpads

Traditional token compaction approaches use secondary heuristic chains
or automated middleware to truncate text, frequently resulting in the
loss of subtle execution context. The self-summarization pattern
transfers this responsibility directly to the active model:

- **The Mechanism:** When the ephemeral conversation buffer approaches a
  designated token ceiling, the harness seamlessly injects a hidden
  system instruction rather than performing an external trim.

- **Scratchpad Execution:** The model is granted a dedicated internal
  scratchpad allocation to evaluate its current operational objective,
  identify obsolete debugging streams, and generate its own highly
  optimized context state summary.

## 2. Verbatim Deletion vs. Semantic Rewriting

Summarizing complex developer logs or stack traces into natural language
descriptions introduces severe semantic degradation. For example,
converting exact compiler outputs into generalized statements like
*"fixed a webhook import error"* strips critical diagnostic data such as
precise line numbers and memory references.

| **Compaction Strategy** | **Risk Profile** | **Optimal Application for vibes** |
|----|----|----|
| **Semantic Rewriting** | High hallucination risk; eliminates line numbers, precise paths, and raw variable signatures. | Avoid entirely for functional codebase states and error logs. |
| **Verbatim Deletion** | None. Preserves exact context string fragments while purging non-essential sequences. | Score blocks locally. Keep critical source blocks completely verbatim; mask or delete low-signal rows entirely. |

## 3. On-Demand Dynamic Tool Discovery

Injecting complete JSON schemas for all available filesystem
capabilities or Model Context Protocol (MCP) servers into the baseline
system prompt creates a massive static token tax before execution
begins. A leaner architectural alternative involves dynamic runtime
discovery:

1.  Provide the agent loop with a highly lightweight index consisting
    solely of basic functional tool names and high-level descriptions.

2.  When the agent determines a specialized operation is required, it
    calls a low-overhead query function to dynamically load the exact
    parameter schema into active context on-demand.
