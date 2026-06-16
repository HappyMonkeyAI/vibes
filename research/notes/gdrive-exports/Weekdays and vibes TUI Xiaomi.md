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
