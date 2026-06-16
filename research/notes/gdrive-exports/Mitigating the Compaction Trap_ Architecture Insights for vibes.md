# **Mitigating the 'Compaction Trap': Architectural Lessons from Anthropic System Failures**

This document details the engineering failure modes identified in native
vendor-side context compaction systems (such as those observed in recent
auto-compact deployments) and establishes a framework for preventing
state corruption within the vibes TUI developer harness.

## **1. The Compaction Trap Deconstructed**

When an agent framework relies on monolithic, unseparated context
buffers, hitting the token limit triggers a recursive state loop known
as the *Compaction Trap*. In this failure mode, the backend model
attempts to summarize its own multi-turn conversational history. In
practice, this abstractive pruning introduces structural memory rot:

- **Narrative Loss:** The overarching project goals and architectural
  constraints are flattened or omitted entirely in favor of recent log
  entries.

- **State Poisoning:** Critical system variables, precise line
  references, and technical stack exceptions are summarized into
  ambiguous natural language terms, causing the agent to repeatedly
  recommend previously failed code patterns.

## **2. Core Strategic Mitigations for vibes**

To insulate the vibes terminal harness from context rot and attention
degradation, the client-side system must enforce strict boundaries on
how token memory is allocated and recycled.

### **A. Explicit Multi-Head Memory Separation**

Decouple the session state completely at the client layer. Never feed
history into the LLM as a single, uniform string or JSON object.
Instead, separate short-term execution scratchpads (the code statements
the model is trying *right now*) from long-term project configurations.
When compaction runs, it must target the execution logs exclusively,
leaving project blue prints entirely untouched.

### **B. The 70% Hard Client Checkpoint Rule**

Relying on backend systems to compress text near the absolute limits of
a context window leads to severe reasoning decay. The safest approach is
a client-side preemptive intervention:

| **Session Phase** | **Token Threshold** | **System Action** |
|----|----|----|
| **Active Execution** | 0% - 69% | Standard terminal loop and interactive I/O logging. |
| **Hard Checkpoint** | 70% | The client-side engine halts the loop, snapshots the directory environment into a structured VIBES_STATE.md file, and physically kills the LLM instance session. |
| **Engine Reinitialization** | Reset to 0% | A completely pristine LLM session is spawned. The harness injects the fresh system instructions and the VIBES_STATE.md checkpoint, bypassing backend compression entirely. |

### **C. Attention Defense & Context Rot Avoidance**

Even when models feature massive context allowances, their internal
attention mechanisms degrade when forced to swim through tens of
thousands of lines of verbose build outputs, docker progress
percentages, or redundant lint logs. Keeping the window artificially
filled with raw stdout streams creates "context distraction," causing
the model to copy its own past behaviors rather than analyzing new file
structures creatively.

## **3. Architectural Blueprint Summary**

By enforcing client-side lifecycle management over the active token
stream, vibes can guarantee deterministic state execution. The client
harness—rather than the AI provider's backend—must remain the absolute
source of truth for the session state machine.
