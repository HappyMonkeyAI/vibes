# Client-Side Database Memory & Context Rehydration: Insights from MiMo Code for vibes

This document evaluates the client-side memory architecture of Xiaomi's
MiMo Code (XiaomiMiMo/MiMo-Code) and outlines how to implement its local
SQLite-backed context reconstruction loop within the vibes TUI developer
harness.

## 1. Four-Layer Local Memory Architecture

Rather than feeding a long, unparsed terminal buffer back into the
primary model, MiMo Code offloads state management to a local,
file-backed SQLite database leveraging the FTS5 (Full-Text Search)
extension. The system abstracts historical states across four discrete
structured markdown definitions:

- **MEMORY.md (Project Memory):** Persistent global rules, framework
  definitions, absolute directory locations, and architecture styles
  that are insulated from truncation.

- **checkpoint.md (Session Checkpoints):** State snapshots written
  asynchronously by an external observer mechanism at runtime.

- **notes.md (Scratch Notes):** Volatile scratchpad memory blocks used
  directly by the agent loop for immediate sub-task calculations.

- **progress.md (Task Logs):** Structured tree tracking high-level goals
  achieved versus remaining objectives during the session.

## 2. The Context Reconstruction Loop (Rehydration over Truncation)

To mitigate the prompt performance degradation caused by sliding context
windows, the reconstruction loop strips the model's history down to its
absolute essentials once threshold limits are met:

| **Reconstruction Step** | **Action Taken** | **Token Impact** |
|----|----|----|
| **1. Threshold Breach** | Foreground execution halts when terminal buffer triggers the context ceiling warning (e.g., 80% utilization). | None (Trigger state). |
| **2. Cache Flush** | The active conversational message array in foreground memory is completely wiped out. | Recovers up to 90% of available window. |
| **3. Rehydration** | A fresh system payload is constructed using a strict mathematical budget: *System Prompt + MEMORY.md + Latest Checkpoint + 3 Recent Verbatim Interacts*. | Establishes an ultra-lean, noiseless initial state. |

## 3. Objective Verification Layer (The Judge Node)

To eliminate premature runtime stops where an agent falsely concludes a
task has succeeded without running local test suites, MiMo Code enforces
an out-of-band verification command (/goal). When an execution loop
attempts to conclude, a secondary local judge script audits the
progress.md ledger against the actual codebase files to verify success
criteria. If discrepancies are found, the failure details are forced
back into the primary agent prompt block.
