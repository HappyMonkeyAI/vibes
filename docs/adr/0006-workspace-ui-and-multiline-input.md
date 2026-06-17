# ADR 0006: Workspace UI, Multiline Input, and Fluid Navigation

- Status: Proposed
- Date: 2026-06-16
- Task: TUI 2.0 UX Redesign

## Context

The current `vibes` Terminal User Interface (TUI) relies on a fragmented layout: a generic dashboard, a single-line input field that shares space with configuration (CWD), and separate views for tasks (`Alt+M`) and logs. This design is rooted in the project's origins as a simple launcher rather than an immersive agentic environment.

Deep research into modern AI agent CLIs (OpenCode, Hermes Agent, Antigravity) and TUI best practices reveals that users expect a persistent, chat-like "Workspace" layout. They need the ability to write complex, multi-line prompts easily, view historical context without switching screens, and navigate settings intuitively without relying solely on the `Tab` key.

## Decision

We will redesign the `vibes` TUI into a "Workspace" paradigm (Vibes TUI 2.0) by implementing the following changes:

### 1. Unified Workspace Layout (`src/tui/components/workspace.tsx`)
- **Deprecate the Launcher Dashboard:** We will remove the current `dashboard.tsx` (which acts as a waiting room) and replace it with a persistent, split-pane `workspace.tsx`.
- **Left Pane (70% - Conversation Stream):** A scrollable chat history displaying the user's past prompts and the agent's markdown-rendered responses. 
- **Right Pane (30% - Task & Minion Tracking):** A persistent view combining the active Mission/Tasks list (formerly hidden behind `Alt+M`) and the background Minion threads (introduced in ADR 0005). We will use clear Unicode symbols (✔, ⏳, ✖) for rapid status scanning.
- **Relocate CWD:** The Current Working Directory (CWD) input will be removed from the main screen and moved exclusively to the Settings view, as users typically launch the tool from their intended working directory.

### 2. Multiline Input Experience
- **TextArea Upgrade:** Replace the single-line `EnhancedTextInput` with a robust Multiline TextArea.
- **Universal Shortcuts:** 
  - `Enter` submits the request to the agent.
  - `Shift+Enter` inserts a new line for complex, multi-paragraph prompting.
- **Slash Commands:** Introduce a `/` intercept in the input area to provide a quick menu for agent commands (e.g., `/yolo`, `/clear`, `/goal`).

### 3. Fluid Keyboard Navigation
- **Settings Navigation:** Update `settings-view.tsx` to allow users to navigate between input fields using the `Up Arrow` and `Down Arrow` keys, supplementing the traditional `Tab` and `Shift+Tab` behavior. This caters to muscle memory from standard text editors.
- **History Scrolling:** When the input box is empty or focus is shifted, `PageUp`/`PageDown` or arrow keys will scroll the conversation stream in the left pane.

## Consequences

### Positive
- **Immersive UX:** Users can manage complex, multi-step agent interactions without losing context or constantly toggling between views.
- **Frictionless Prompting:** The multiline input with standard `Shift+Enter` behavior allows for pasting large code blocks or writing detailed instructions directly in the terminal.
- **Industry Alignment:** The layout and keyboard shortcuts align with the established standards set by top-tier agent tools, reducing the learning curve for new users.

### Negative
- **Ink Rendering Complexity:** Building a reliable, scrollable chat history pane alongside a dynamic task list in Ink requires careful management of terminal height (`process.stdout.rows`) and focus states to prevent rendering glitches.

## Implementation Steps

1. Relocate the CWD configuration logic to `settings-view.tsx` and implement Up/Down arrow navigation.
2. Build the new Multiline TextArea component with `Enter` (submit) and `Shift+Enter` (newline) logic.
3. Scaffold `workspace.tsx` with the 70/30 split pane, integrating the new input and a scrollable conversation log.
4. Update `src/index.tsx` to use `Workspace` as the primary view instead of `Dashboard`.
