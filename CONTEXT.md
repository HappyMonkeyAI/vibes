# CONTEXT: Vibes Project Operating Manual

## Stack & Runtime

| Layer | Technology |
|-------|-----------|
| Runtime | Node >=22, TypeScript 5.7 (strict) |
| TUI | Ink 6 + React 19 + `@inkjs/ui` 2.0 |
| Agent SDK | OpenAI SDK (Ollama/LM Studio compatible) |
| Validation | Zod 3.24 |
| MCP | fastmcp 4.0 + custom stdio/SSE client |
| Package | ESM-only (`"type": "module"`) |

## Non-Negotiable Rules

- **ESM only** — no `require()`, no `__dirname`. Use `import.meta.url` for path resolution.
- **Ink TextInput quirk** — `@inkjs/ui` TextInput has limited controlled-prop support. Use `defaultValue`, never `value`. Isolate re-renders to prevent cursor jumps.
- **Alt-key guards** — all global shortcuts must be guarded in `useInput` to prevent character leakage into text fields when a TextInput is focused.
- **Build-gate** — must pass `npm run build` (tsc) before any `feat`/`fix` commit.
- **Tool output discipline** — shell tool must capture full stderr. Never hallucinate success.
- **No `.js` in `src/`** — some `.js` files exist as compiled artifacts; don't add new ones. Write only `.ts`.

## Workflow

See `AGENTS.md` for full agent workflow protocol (Donahoe Loop, Quick vs Deep mode, Staging Ratchet).

Key points:
- Feature branches prefixed `ag/` — e.g. `ag/fix-auth-bug`
- Conventional commits: `feat:`, `fix:`, `refactor:`
- Never force-push, never amend published commits
- Auto-git snapshot taken pre-mission via Vibes UI (`Alt+N`)

## Resolved Architecture Decisions

ADRs live in `.antigravity/memories/architectural_decisions/`. Key decisions:

| Decision | Rationale |
|----------|-----------|
| **DAG-based scheduler** over linear queue | Enables parallel task execution (up to MAX_CONCURRENT_TASKS) with dependency resolution |
| **MCP via stdio+SSE** | Protocol-agnostic; supports local subprocess and remote servers |
| **Promise-blocking interventions** | Keeps agent state "warm" during human-in-the-loop pauses |
| **Local JSONL memory** as primary store | Zero-dependency persistence; Mem0 is optional remote peer dep |
| **OpenAI SDK for all backends** | Universal model discovery via `models.list()` — works with Ollama, LM Studio, vLLM |
| **Codex RAG (Neo4j)** | Retrieval-augmented patterns for small-model augmentation; 5-min circuit breaker on connection failure |
| **Tech-stack detection at plan time** | Single I/O scan in MissionPlanner, propagated through Scheduler -> TaskExecutor |

## What Not To Do

- Don't hardcode API keys. Use `${VARIABLE}` in `.vibes/mcp.json` — expanded from `.env` at runtime.
- Don't dump raw logs into agent execution feed. Keep Task View (agent intent) separate from Log Stream (diagnostics).
- Don't use `TextInput` with `value` prop — it causes cursor reset on parent re-render.
- Don't replace entire files >200 lines. Use surgical scoped edits.
- Don't add `.js` source files. `.ts` only.
- Don't commit to `main` directly — always use `ag/*` branches.
- Don't skip `npm run build` before commit.

## Project-Specific Guidance

### File Map

| Path | Purpose |
|------|---------|
| `src/index.tsx` | Entry point, TUI root, keyboard shortcut wiring |
| `src/agent/mission-planner.ts` | Decomposes user prompt -> milestones -> tasks |
| `src/agent/scheduler.ts` | DAG scheduler, parallel slot management, intervention handling |
| `src/agent/task-executor.ts` | Per-task agent loop (tool calls, streaming, thrash detection) |
| `src/agent/context-manager.ts` | Token counting, message compression, hard cap at 150 messages |
| `src/agent/structural-audit.ts` | Stack-aware code quality audit (React hooks, Python patterns, etc.) |
| `src/agent/triage-agent.ts` | Pre-flight task classification and routing |
| `src/agent/tech-stack.ts` | Workspace stack detection (package.json + file scan) |
| `src/agent/model-prompts.ts` | Role-specific system prompts (planner, executor, reviewer) |
| `src/agent/json-repair.ts` | Fallback parser for models that can't render tool call schemas |
| `src/agent/session-service.ts` | Session persistence (JSONL) and replay |
| `src/mcp/mcp-service.ts` | MCP client manager — loads `.vibes/mcp.json`, manages subprocess lifecycles |
| `src/mcp/codex-service.ts` | Neo4j RAG client — Python subprocess -> embeddings -> vector search |
| `src/memory/memory-service.ts` | LTM read/write, pre-task enrichment, post-task synthesis |
| `src/tui/hooks/use-mission.ts` | React state bridge between agent Scheduler and TUI views |
| `src/tui/components/` | All Ink components: dashboard, task-view, settings-view, log-stream, etc. |
| `src/tools/shell-tool.ts` | Shell command execution with full stderr capture |
| `src/config.ts` | Zod schema merging `.env` + `.vibes/config.json` |
| `.vibes/config.json` | Runtime config — model, context window, feature flags |
| `.vibes/mcp.json` | MCP server definitions (one or more stdio/SSE servers) |

### Config Precedence

`.env` -> `.vibes/config.json` (Zod union merge). CLI flags override both.

### Memory Architecture

LTM at `.antigravity/memories/` with three types:
- `codebase_insights/` — semantic (module summaries, hidden logic)
- `architectural_decisions/` — semantic (ADRs)
- `patterns_and_lessons.md` — procedural (success patterns, failure post-mortems)
- `history/` — episodic (plan/walkthrough archives, handoffs)

All memory files require YAML frontmatter with `type`, `tags`, `created`, `blast_radius`, `confidence`.

### Testing

Node built-in test runner (`node --test`). Test files in `tests/` as `.mjs`. Example:
```
npm run build && node --test tests/config.test.mjs tests/triage-agent.test.mjs
```
