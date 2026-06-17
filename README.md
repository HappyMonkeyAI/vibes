# 🌌 Vibes

**Vibes** is a high-performance, autonomous TUI (Terminal User Interface) harness designed for the **Gemma4 26B** model. It empowers you to manage complex missions by breaking them down into actionable milestones and tasks, all within a sleek, interactive terminal environment.

Built with **Ink 6** and **React 19**, Vibes connects to local LLM servers (Ollama, LM Studio) to provide a state-of-the-art agentic experience with hierarchical planning and DAG-based autonomous scheduling.

---

## ✨ Features

- **🎯 Hierarchical Mission Planning**: Automatically break down high-level missions into milestones and actionable tasks using Gemma4's 32K context window.
- **🤖 Autonomous Agent Loop**: Executes individual tasks with a robust loop, supporting tool calls, streaming responses, and reasoning-first thinking.
- **📅 DAG-Based Scheduler**: Manages task dependencies, parallel execution, deadlock detection for circular `depends_on` chains, and auto-discovery of new tasks during execution.
- **📟 Interactive TUI**: A premium terminal experience featuring:
  - **Dashboard**: High-level progress and statistics.
  - **Mission View**: Tree structure of missions, milestones, and tasks.
  - **Trace / Task / Review / Logs**: Execution trace, live agent output, reviewer feedback, and diagnostic logs.
  - **Settings**: Real-time configuration, model switching, and workspace root (`VIBES_LAUNCH_DIR`).
  - **Multiline Mission Prompt**: Paste-friendly input with **Alt+Enter** for newline (works over SSH/Termius).
- **🛠️ Integrated Toolset**: Native support for file operations (`read`, `write`, `edit`, `glob`, `grep`), shell command execution, and workspace-wide symbol search.
- **🔌 MCP & Plugin Support**: First-class support for the Model Context Protocol (MCP) with dynamic environment variable expansion in `.vibes/mcp.json`.
- **♻️ Context Reconstruction (Beta)**: Automatically rebuilds a lean, grounded context from state files (`MEMORY.md`, `checkpoint.md`, etc.) when token limits are approached.
- **🛡️ Safety & Reliability**: 
  - **Auto-Git Snapshots**: Commits workspace state before missions; auto-`git init` for scratch workspaces.
  - **Undo Mission (`Alt+Z`)**: Instantly reset the workspace if an agent botches a task.
  - **Thrashing Detection**: Automatically pauses if the agent gets stuck in a tool-call loop.
  - **Scheduler Deadlock Detection**: Fails fast with a clear error when the plan has circular task dependencies.

---

## 🧠 Model Flexibility & Local Optimization

While **Vibes** was built to leverage the specific reasoning and tool-calling strengths of **Gemma4**, its architecture is heavily optimized for **local, consumer-grade LLMs**. We believe you shouldn't need a cluster of H100s to run a capable agent.

- **🏠 Local-First**: Optimized for running on Ollama, LM Studio, or vLLM.
- **📉 Small Model Support**: Features like **Codex RAG**, **Local Memory**, and **JSON Self-Healing** allow models as small as **9B** (like Qwen 2.5) to perform complex multi-file coding tasks.
- **🎭 Heterogeneous Roles**: Assign different models to different roles (Planner, Executor, Reviewer) to balance speed and intelligence.
- **🛡️ The "Executor Contract"**: A strict verification layer that prevents small models from "hallucinating success" by forcing ground-truth checks against the filesystem.

👉 **View our [Local LLM & Small Model Benchmark Report](SMALL-MODEL-TESTING.md)** for recommended stacks and performance data.

---


### Prerequisites

- **Node.js**: v22 or higher (v20 may work)
- **Ollama**: Access to an Ollama instance. While Vibes is optimized for **Gemma4 26B** (`VladimirGav/gemma4-26b-16GB-VRAM:latest`), it is compatible with any model that supports OpenAI-style tool calling (e.g., Llama 3.1, Mistral, DeepSeek) by simply updating the `.env` configuration.


### 🚀 Quick Install (Linux)

The easiest way to install Vibes and set up the global `vibes` command is using our automated installer:

```bash
curl -fsSL https://raw.githubusercontent.com/SPhillips1337/Vibes/main/install.sh | bash
```

This script will:
- Clone the repository to `~/Vibes`.
- Install dependencies and build the project.
- Add a `vibes` function to your shell configuration (`.bashrc`, `.zshrc`).
- Enable **Automatic Workspace Detection** (defaults to launch directory; override via `VIBES_LAUNCH_DIR` in Settings).

### 🪟 Quick Install (Windows)

```powershell
irm https://raw.githubusercontent.com/SPhillips1337/Vibes/main/install.ps1 | iex
```

This script will:
- Clone the repository to `$HOME\Vibes`.
- Install dependencies and build the project.
- Add a `vibes` function to your PowerShell `$PROFILE`.
- Enable **Automatic Workspace Detection** (Vibes will default to the directory you launched it from).

---

### Manual Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SPhillips1337/vibes.git
   cd vibes
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   Create a `.env` file in the root directory:
   ```env
   OLLAMA_BASE_URL=https://your-ollama-endpoint/v1
   OLLAMA_MODEL=VladimirGav/gemma4-26b-16GB-VRAM:latest
   OLLAMA_API_KEY=ollama
   CONTEXT_WINDOW=32768
   ```

---

### Running Vibes

#### npm

Install the published CLI globally:

```bash
npm install --global vibes-tui
vibes
```

Or run it without a global install:

```bash
npx vibes-tui
```

Local JSONL memory works without additional packages. To use the optional
remote Mem0 integration, install it alongside Vibes:

```bash
npm install --global vibes-tui mem0ai
```

#### ⚡ Using the Global Command
If you used the quick installer, you can launch Vibes from **any directory** on your system:

```bash
vibes
```
*Note: Vibes defaults to your launch directory as the workspace root. Set **Current Working Dir** (`VIBES_LAUNCH_DIR`) in Settings to target a different project folder.*

#### 🛠️ Development & Manual Execution
- **Development Mode** (with hot reload):
  ```bash
  npm run dev
  ```

- **Production Build**:
  ```bash
  npm run build
  npm start
  ```

- **Direct Execution**:
  ```bash
  tsx src/index.tsx
  ```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Alt+D` | Switch to **Dashboard** |
| `Alt+M` | Switch to **Mission** view |
| `Alt+T` | Switch to **Trace** view |
| `Alt+Shift+T` | Switch to **Task** view (live agent output) |
| `Alt+R` | Switch to **Review** view |
| `Alt+L` | Switch to **Logs** view |
| `Alt+H` | Switch to **History** view |
| `Alt+S` | Open **Settings** |
| `Alt+N` | Create a **New Mission** |
| `Alt+Enter` | **Newline** in mission prompt (`Enter` submits) |
| `Alt+Z` | **Undo Mission** (git hard-reset) |
| `Alt+Y` | Toggle **YOLO Mode** |
| `Alt+C` | Toggle **Codex RAG** |
| `Alt+X` | **Dismiss** update notification |
| `Ctrl+Q` | **Quit** the application |
| `Tab` | Cycle focus between panels |

See the full [Usage Guide](wiki/usage.html) and [Configuration](wiki/configuration.html) in the wiki.

---

## 🏗️ Architecture

- **`src/index.tsx`**: Entry point and TUI initialization.
- **`src/agent/`**: The brain of Vibes, containing the mission planner, task executor, and autonomous scheduler.
- **`src/tui/`**: React-based terminal components using Ink.
- **`src/tools/`**: A registry of Zod-validated tools for the agent to interact with the system.

---

## 📝 License

This project is licensed under the [MIT License](LICENSE.md).

---

*Built with ❤️ for the Gemma community.*
