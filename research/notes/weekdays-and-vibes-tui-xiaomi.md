---
type: research-note
tags: [vibes, xiaomi, mimo-code, sqlite, memory, context-reconstruction]
created: 2026-06-16
source: "Weekdays and vibes TUI Xiaomi"
status: imported-from-google-drive-export
---

# Weekdays and vibes TUI Xiaomi

## Source
- Google Drive export: `gdrive/Weekdays and vibes TUI Xiaomi.docx`
- Google Drive document name: `Weekdays and vibes TUI Xiaomi`
- Local transcript: `gemini_chat.txt`
- Transcript anchor: No exact title match found in gemini_chat.txt; source recovered from Drive export.
- Referenced links:
  - https://github.com/XiaomiMiMo/MiMo-Code

## Summary
Drive export describes a Vibes TUI context reconstruction architecture: a 4-layer markdown state model mirrored into SQLite FTS5, with token-threshold capture, active-history wipe, lean payload rehydration, and out-of-band `/goal` validation.

## Key takeaways
- Split durable state into `MEMORY.md`, `checkpoint.md`, `notes.md`, and `progress.md` layers.
- Mirror context snapshots into SQLite FTS5 for fast historical lookup without bloating active model context.
- On token pressure, dump state, clear working message arrays, then repack from system rules, memory, latest checkpoint, and three verbatim interaction pairs.
- Add `/goal` validation as a synchronous lock before completion.

## Vibes implementation implications
- This overlaps with the MiMo Code local-memory architecture note and should be considered part of the same context-rehydration workstream.
- Prototype the lifecycle as middleware around `TaskExecutor` / context manager before changing scheduler semantics.
- Treat filesystem state files and SQLite index as client-owned truth, not model-generated summaries.

## Caveats / verification needed
- The title does not match the actual document heading; use the Drive export content as source of record.

## Follow-up questions
- Which ideas should become ADRs versus experiments?
- Which claims require direct source validation before coding?

## Full Google Drive export

_Source file: `gdrive/Weekdays and vibes TUI Xiaomi.docx`_

# Vibes TUI Context Reconstruction Architecture & State Specifications

**Author:** Systems Engineering Team

**Target System:** vibes TUI Sandbox Layer

## 1. Executive Summary & Design Paradigm

The vibes Terminal User Interface (TUI) harness introduces a discrete,
state-driven 4-layer memory model designed to maintain structural
consistency, execution predictability, and near-zero latency processing
over extended agent lifecycles. By transitioning away from standard
uncalibrated linear token truncation windows, this mechanism enforces an
aggressive compaction and state reconstruction pipeline when working
memory crosses critical operational thresholds.

## 2. The Four-Layer Filesystem Layout

The single source of truth is mapped onto four decoupled markdown text
primitives handled asynchronously via the local file layer. This ensures
that essential workspace configurations, context indicators, and ongoing
milestones remain immutable across context flushes.

| **Store Component** | **Sync Interval** | **Primary Architectural Enforcement Objective** |
|----|----|----|
| MEMORY.md | Initialization / Updates | Workspace roots, strict coding parameters, environment constraints, frontmatter metadata. |
| checkpoint.md | Test Success / 5-min Intervals | Active environment variables, active dirty files buffers, current Git SHA verification keys. |
| notes.md | Immediate on Block Close | Unstructured agent runtime logs, deep system discoveries, discovery telemetry fragments. |
| progress.md | Pre/Post Model Cycle | Tree-structured micro-objective hierarchies tracking completed versus remaining items. |

## 3. Local SQLite FTS5 Search Infrastructure

To query and look up historical chat components, structural conversation
records are mirrored into an embedded SQLite schema utilizing virtual
full-text search extensions. Transactions are committed as append-only
records to guarantee that terminal rendering is not choked or blocked
during intense text processing cycles.

> CREATE VIRTUAL TABLE IF NOT EXISTS fts_context_index USING fts5(  
> layer_name,  
> raw_content,  
> content='context_snapshots',  
> content_id='id'  
> );

## 4. Reconstruction Middleware Lifecycle Matrix

The runtime engine monitors token counts constantly. When the total
context payload crosses the designated upper limit, a non-destructive
state reconstruction cycle is executed immediately:

1.  **Capture & Dump:** Active chat historical elements are cleanly
    compiled, structured into JSON blobs, and written into the
    context_snapshots database.

2.  **Wipe & Reclaim:** Working sequence arrays are cleared, immediately
    reclaiming precious system context window fields.

3.  **Pack Payload:** A fresh system injection payload is derived
    strictly following this allocation formula: System Guidelines +
    MEMORY.md + Latest Checkpoint + 3 Verbatim Interaction Pairs.

## 5. Automated Out-of-Band Goal Validation Loop

The /goal terminal execution target acts as a synchronous lock.
Foreground generation loops are completely halted until a decoupled
out-of-band evaluation process checks actual file modifications against
target keys registered within progress.md, ensuring deterministic
execution reliability.
