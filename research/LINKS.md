# Research Links

## Core Stack

| Resource | URL | Why |
|----------|-----|-----|
| Ink docs | https://github.com/vadimdemedes/ink | TUI framework — React for CLIs |
| InkJS UI | https://github.com/vadimdemedes/inkjs-ui | Pre-built Ink components (TextInput, Select) |
| fastmcp | https://github.com/punkpeye/fastmcp | MCP server framework used by Vibes |
| OpenAI SDK (TS) | https://github.com/openai/openai-node | Agent LLM client — works with Ollama/LM Studio |

## MCP Protocol

| Resource | URL | Why |
|----------|-----|-----|
| Model Context Protocol spec | https://spec.modelcontextprotocol.io | MCP transport, tool calling, resource definitions |
| MCP SDK (TS) | https://github.com/modelcontextprotocol/typescript-sdk | Reference implementation |

## Agentic Workflows

| Resource | URL | Why |
|----------|-----|-----|
| Anthropic agent cookbook | https://github.com/anthropics/anthropic-cookbook | Agent loop patterns, tool use examples |
| OpenAI function calling | https://platform.openai.com/docs/guides/function-calling | Tool call schema standard |
| MiMo Code | https://github.com/XiaomiMiMo/MiMo-Code | Verified primary source for terminal-native assistant, SQLite FTS5 memory, four state files, context reconstruction, and `/goal` judge |
| Agentic AI System Course | https://github.com/bryanyzhu/agentic-ai-system-course | Verified primary source for general agentic-system concepts: goals, planning, tools, feedback, memory |
| Cursor SDK / docs | https://docs.cursor.com/en/welcome | Verified public Cursor docs for Agent mode, Rules, MCP, Skills, CLI, and models; architecture claims still need narrower sources |
| Cursor product page | https://cursor.com/get-started | Verified public product page; use only for high-level Cursor reference |
| X thread: compaction trap discussion | https://x.com/i/status/2066185785204719769 | Community/secondary source; claims are not primary-source verified |
| X video: fork-join / Antigravity discussion | https://x.com/i/status/2064885327375024181 | Community/secondary source; Antigravity API/threshold claims are not primary-source verified |

## Local LLM

| Resource | URL | Why |
|----------|-----|-----|
| Ollama | https://ollama.ai | Local model runner — primary Vibes backend |
| LM Studio | https://lmstudio.ai | Alternative backend with OpenAI-compatible API |
| Gemma docs | https://ai.google.dev/gemma | Model guide for Gemma4 |

## TUI / Terminal

| Resource | URL | Why |
|----------|-----|-----|
| React Ink TextInput quirks | https://github.com/vadimdemedes/ink/issues | Known issues with cursor, controlled props |
| SGR mouse protocols | https://invisible-island.net/xterm/ctlseqs/ctlseqs.html | Mouse event handling in terminals |

## Vector / RAG

| Resource | URL | Why |
|----------|-----|-----|
| Neo4j vector index | https://neo4j.com/docs/cypher-manual/current/indexes-for-vector-search/ | Codex knowledge graph backend |
| nomic-embed-text | https://ollama.ai/library/nomic-embed-text | Local embedding model fallback |
