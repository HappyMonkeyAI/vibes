# Context Reconstruction & State Hydration

Vibes includes an advanced **Context Reconstruction** system designed to handle long-running agent tasks without losing critical project state or hitting token limits.

This feature is currently behind a feature flag.

## 🚀 Enabling the Feature

To enable context reconstruction, add the following to your `.env` file or `.vibes/config.json`:

```env
ENABLE_CONTEXT_RECONSTRUCTION=true
```

You can also adjust the threshold (default 80%) at which reconstruction triggers:

```env
RECONSTRUCTION_THRESHOLD=0.8
```

## 🏗️ How it Works

When token usage hits the threshold, the `TaskExecutor` triggers a **Reconstruction Cycle**:

1.  **State Capture:** The agent ensures current discovery and progress are persisted to the four-layer state files.
2.  **Verbatim Preservation:** The last 2 turns of the conversation are captured to maintain immediate "short-term memory."
3.  **Context Wipe:** The bloated conversation history (often full of long terminal outputs) is purged.
4.  **Rehydration:** A new, lean context is built from:
    -   The core system prompt and project rules.
    -   `MEMORY.md`: Durable project facts.
    -   `checkpoint.md`: Latest environment and execution state.
    -   `progress.md`: Active goals and checklists.
    -   `notes.md`: Recent scratchpad findings.
    -   The preserved verbatim turns.

## 📂 The Four-Layer State Files

These files are located in your workspace root during execution. The agent is responsible for keeping them updated.

| File | Purpose | Sync Trigger |
| :--- | :--- | :--- |
| `MEMORY.md` | Durable project rules, stack assumptions. | Manual / Init |
| `checkpoint.md` | Latest verified state, environment, dirty files. | Success / Interval |
| `notes.md` | Bounded scratchpad and discovery notes. | Post-interaction |
| `progress.md` | Hierarchical goal checklist and blockers. | Pre/Post-interaction |

## 🛠️ Operation & Troubleshooting

### Inspecting State
You can monitor these `.md` files in real-time. If they are not being updated, ensure the agent has permissions to write to the workspace root.

### Recovering from Corrupted State
If the state files become corrupted or out of sync:
1.  **Stop Vibes.**
2.  **Fix or Delete** the offending `.md` file. The agent will attempt to recreate them if missing.
3.  **Restart the Mission.**

### Validation
To manually validate the loop, you can use the E2E test suite:
```bash
npm run build && node --test tests/context-reconstruction-e2e.test.mjs
```

## 📈 TUI Telemetry
When a reconstruction event occurs, a `system_log` event is emitted. The TUI (in a future update) will display a "Context Reconstructed" notification in the task view to keep the operator informed.
