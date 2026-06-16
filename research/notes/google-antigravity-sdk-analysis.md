---
type: research-note
tags: [vibes, antigravity, hooks, compaction, multi-agent]
created: 2026-06-16
source: "Google Antigravity SDK Analysis for vibes"
status: imported-from-google-drive-export
---

# Google Antigravity SDK Analysis for vibes

## Source
- Google Drive export: `gdrive/Google Antigravity SDK Analysis for vibes.docx`
- Google Drive document name: `Google Antigravity SDK Analysis for vibes`
- Local transcript: `gemini_chat.txt`
- Transcript anchor: gemini_chat.txt lines 195-320
- Calendar review block: Tue, Jun 16 2026, 15:00-16:00

## Summary
The Antigravity discussion frames useful harness concepts as lifecycle hooks and isolated sub-agent scopes: inspect for telemetry, decide for policy/HITL, transform for data mutation/compaction, and delegate for scoped child contexts.

## Key takeaways
- Classify loop middleware as Inspect, Decide, or Transform.
- Use blocking Decide hooks for destructive operations and human approvals.
- Use Transform hooks to strip or reshape bloated stdout before it enters model memory.
- Use child agents with isolated context windows for broad tasks, returning only structured results.

## Vibes implementation implications
- Refactor Vibes hook surfaces around explicit intercept types.
- Treat compaction as a transform hook in the message/tool-result pipeline.
- Expose sub-agent panes or task lanes in the TUI without merging child logs into parent context.

## Caveats / verification needed
- The transcript contains specific Antigravity SDK/API claims that must be verified against official Google docs before relying on names, thresholds, or package APIs.

## Follow-up questions
- Which ideas should become ADRs versus experiments?
- Which claims require direct source validation before coding?

## Full Google Drive export

_Source file: `gdrive/Google Antigravity SDK Analysis for vibes.docx`_

# Google Antigravity SDK Architectural Analysis for vibes

This document evaluates the architectural design of Google's Antigravity
SDK (google-antigravity) and details how its native compaction limits,
execution lifecycle hooks, and sub-agent team delegation patterns can be
applied directly to the vibes TUI developer harness.

## 1. Automated Compaction Thresholds (~135k Tokens)

The Antigravity runtime operates natively on Gemini models within
managed sandbox loops. To counter the compounding token costs and
latency of long-horizon developer loops, the SDK tracks buffer sizes
programmatically:

- **The Compaction Trigger:** When active session logs scale to
  approximately 135,000 tokens, the core runtime pauses execution to
  trigger a compaction pass, shielding the agent from context overflow.

- **The Developer Hook:** The SDK exposes this step via a custom
  context_compaction hook, giving developers programmatic control to
  define exactly which system files, environment states, or terminal
  logs are prioritized or pruned.

## 2. Intercept Architecture: Inspect, Decide, Transform

To safely manage agent loops inside an interactive developer framework,
the Antigravity SDK segments its middleware into a clear lifecycle
intercept matrix:

| **Hook Type** | **Execution Nature** | **Target Use Case in vibes** |
|----|----|----|
| **Inspect** | Read-Only, Non-Blocking | Streaming live telemetry, log audits, or UI state variables out to dashboard sidebars without delaying the core loop. |
| **Decide** | Read-Only, Blocking | Enforcing safety guards or human-in-the-loop (HITL) prompt approvals before executing destructive terminal commands. |
| **Transform** | Modifying, Blocking | Intercepting bloated stdout streams or stack traces in transit and stripping repetitive rows before they populate LLM memory. |

## 3. Sub-Agent Scope Delegation

Rather than processing a wide-ranging engineering directive within a
single text buffer, the Antigravity pattern delegates complex problems
to temporary sub-agent teams:

- **Context Isolation:** The parent agent spawns a child agent inside an
  isolated, short-lived sandbox scope equipped only with task-specific
  tools (e.g., managing a specific local repository file).

- **Clean Merge:** The sub-agent's local debugging, test compilation
  failures, and granular adjustments are contained within its own
  runtime window. Only the final successful result or code patch is
  returned to the parent, keeping the primary history highly clean.
