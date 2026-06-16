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
