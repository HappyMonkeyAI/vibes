---
type: research-note
tags: [vibes, context, compaction, architecture, tui]
created: 2026-06-16
source: "Smart Context Compaction Architecture for vibes"
status: imported-from-google-drive-export
---

# Smart Context Compaction Architecture for vibes

## Source
- Google Drive export: `gdrive/Smart Context Compaction Architecture for vibes.docx`
- Google Drive document name: `Smart Context Compaction Architecture for vibes`
- Local transcript: `gemini_chat.txt`
- Transcript anchor: gemini_chat.txt lines 1-105
- Calendar review block: Tue, Jun 16 2026, 10:00-11:00

## Summary
Smart compaction should treat a developer harness context as workflow state plus an ephemeral execution stream, not as a flat transcript. High-signal state is extracted into durable structures while noisy logs are pruned or summarized.

## Key takeaways
- Use a dual-layer context model: structured workflow state plus recent raw stream.
- Track dependencies, environment changes, active errors, and pinned files as first-class state.
- Collapse resolved error/fix/test loops once verification passes.
- Run low-cost regex/AST filters before any model-based summarization.
- Prefer asynchronous background compaction to avoid blocking the TUI.

## Vibes implementation implications
- Add explicit workflow-state objects to the agent loop instead of relying solely on message history.
- Promote file reads/edits, installed packages, env changes, and active errors into compact state blocks.
- Keep the last few raw turns verbatim; aggressively prune older low-signal logs.

## Caveats / verification needed
- Imported from gemini_chat.txt / user-provided Drive document names; claims should be verified against primary sources before implementation decisions.

## Follow-up questions
- Which ideas should become ADRs versus experiments?
- Which claims require direct source validation before coding?

## Full Google Drive export

_Source file: `gdrive/Smart Context Compaction Architecture for vibes.docx`_

# Smart Context Compaction Architecture for vibes

This document outlines a conceptual framework for moving from a static,
token-driven context truncation model to an agentic, workflow-aware
semantic pruner designed specifically for a terminal-based developer TUI
harness like vibes.

## 1. The Core Architecture: Dual-Layer Context

Instead of maintaining a single, flat linear history of the terminal
session, the context window should be bifurcated into two distinct
abstraction layers:

| **Context Layer** | **Description** | **Compaction Action** |
|----|----|----|
| **The Workflow State** | A structured, persistent state machine tracking current goals, active errors, system configuration, and file modifications. | Continuously updated and accumulated; never truncated unless a scope boundaries change. |
| **The Ephemeral Stream** | The raw, linear buffer of recent terminal inputs, command outputs (stdout/stderr), and user conversations. | Aggressively pruned and cleared once key data points are extracted into the Workflow State. |

## 2. Workflow-Aware Pruning Strategies

Tokens must be evaluated based on their functional utility to the active
execution loop rather than pure chronological recency.

### A. Dependency & Variable Lifecycle Tracking

When environmental mutations occur (e.g., npm install, changing .env
keys, exporting variables), the compaction system extracts the resultant
state into a permanent system block. The verbose installation logs
within the conversation ledger are subsequently discarded, preventing
the model from losing track of environment changes over long sessions.

### B. Execution Thread Collapse (Self-Healing Loops)

During development loops involving iterative bug-fixing, multi-step
failures generate extensive token overhead (such as massive stack
traces). Once a step succeeds (e.g., exit code 0 or successful test
execution), the compaction loop replaces the entire intermediate broken
code history with a structured summary line:

> \[RESOLVED LOOP\]: Fixed import exception in auth.js by modifying line
> 12. Context cleared.

### C. Semantic File Pinning

Core application source files actively under review are pinned in memory
as structural entities. While the conversational turns surrounding them
can fade out via a moving window mechanism, the current state of the
code files is explicitly preserved until a workflow boundary is cleanly
passed.

## 3. Multi-Tiered Implementation Strategy

To optimize performance and minimize API operational costs, compaction
can be handled via a tiered evaluation structure:

> Tier 1: Deterministic RegEx and AST Parsing (Local, Zero-Cost)

1.  Strip verbose build output, repeating lines, webpack status ticks,
    or Docker installation tracking components down to simple
    single-line markers.

2.  Truncate redundant runtime stack traces to isolate only the target
    exception line and the initial application-level call frames.

> Tier 2: Asynchronous Local Micro-Models (Ollama / LM Studio)

3.  Utilize small, performant local LLMs (e.g., 3B or 8B parameters)
    dedicated solely to the semantic processing of logs background-side.

4.  Trigger compaction asynchronously based on token buffer margins so
    that foreground processing loops suffer no user-facing latency
    penalties.
