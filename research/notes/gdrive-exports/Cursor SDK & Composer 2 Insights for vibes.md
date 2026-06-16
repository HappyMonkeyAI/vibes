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
