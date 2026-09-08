---
type: semantic
tags: [ink, react, tui, mcp, configuration]
created: 2026-07-22
related: [../architectural_decisions/mcp-transport.md]
blast_radius: [src/tui/, src/mcp/, src/config.ts, .vibes/mcp.json]
confidence: high
---

# TUI, configuration, and MCP boundaries

`src/index.tsx` and `src/tui/` own the Ink/React presentation and keyboard routing. Agent services must not depend on transient React state for execution control; the established intervention path uses a scheduler reference. `src/mcp/mcp-service.ts` owns `.vibes/mcp.json` loading and subprocess lifecycle management, while `src/config.ts` merges environment and JSON configuration.

MCP configuration is shareable only when credentials remain `${VARIABLE}` placeholders. New transports or providers need coverage for environment expansion, lifecycle cleanup, and the existing ESM/TypeScript build gate.

Evidence: `CONTEXT.md` file map and non-negotiable rules; `AGENTS.md` API/protocol rules; `docs/adr/0006-workspace-ui-and-multiline-input.md`.
