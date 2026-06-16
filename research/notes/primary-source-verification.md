---
type: research-note
tags: [vibes, source-verification, research, context-reconstruction]
created: 2026-06-16
status: verified-pass-1
---

# Primary-Source Verification Pass — Context Reconstruction Research

Task: `task-012`

Scope: verify the highest-risk claims from the imported `gdrive/` notes before those claims are used as implementation facts. This pass checked reachable primary sources only. X/Twitter discussion links are treated as secondary/community sources unless the claim is independently confirmed elsewhere.

## Summary

| Claim area | Verification result | Action for Vibes |
|------------|---------------------|------------------|
| MiMo Code exists as XiaomiMiMo/MiMo-Code | Verified from GitHub API and README | Safe to reference as an external project |
| MiMo Code is terminal-native and has persistent memory | Verified from README | Safe to cite |
| MiMo Code uses SQLite FTS5 and four memory files | Verified from README | Safe to cite as inspiration |
| MiMo Code has context reconstruction near window limits | Verified from README at concept level | Safe to cite; avoid unverified numeric thresholds |
| MiMo Code `/goal` independent judge | Verified from README | Safe to cite |
| Agentic AI System Course exists and covers agentic system concepts | Verified from GitHub README | Safe to cite generally |
| Cursor has public docs / product pages for coding agent concepts | Verified from Cursor pages | Safe to cite generally |
| Cursor Composer 2 / 2.5 internal architecture claims | Not verified from available public source in this pass | Do not cite as fact; keep as hypothesis unless sourced |
| Google Antigravity SDK with `context_compaction` hook and ~135k trigger | Not verified from reachable primary source in this pass | Treat as unverified; do not use product/API names as facts |
| Claude Code auto-compaction failure details from X thread | Not verified from primary source in this pass | Treat as community report; use only as risk framing |
| Morph Compact implementation details | Not verified from primary source in this pass | Treat as unverified until source is found |
| X thread benchmark/community claims | Not primary-source verified | Do not promote to ADR facts |

## Verified primary sources

### XiaomiMiMo/MiMo-Code

Sources checked:

- `https://raw.githubusercontent.com/XiaomiMiMo/MiMo-Code/main/README.md`
- `https://api.github.com/repos/XiaomiMiMo/MiMo-Code`

Verified README statements:

- MiMoCode is described as a terminal-native AI coding assistant.
- It can read/write code, run commands, manage Git, and use persistent memory.
- Persistent memory is described as cross-session memory powered by SQLite FTS5.
- README lists:
  - `MEMORY.md` for project memory;
  - `checkpoint.md` for session checkpoints;
  - `notes.md` for scratch notes;
  - `tasks/<id>/progress.md` for per-task logs.
- README describes intelligent context management with automatic checkpoints and context reconstruction when context approaches the limit.
- README describes `/goal` as a stopping condition evaluated by an independent judge model when the agent tries to stop.

Implication:

- Vibes can safely use MiMo Code as a primary-source-backed reference for the local memory/context-reconstruction direction.
- Numeric claims like exact threshold percentages or token recovery percentages remain unverified unless found in MiMo docs/source.

### bryanyzhu/agentic-ai-system-course

Sources checked:

- `https://raw.githubusercontent.com/bryanyzhu/agentic-ai-system-course/main/README.md`
- `https://api.github.com/repos/bryanyzhu/agentic-ai-system-course`

Verified README statements:

- The repository exists.
- It describes a 22-chapter skeleton course on designing, building, and operating production AI agents.
- It frames agentic systems around planning, decision-making, tools, feedback adaptation, memory, and autonomous goal pursuit.

Implication:

- Safe to cite as a general conceptual reference for agentic systems.
- Do not cite it as evidence for any specific Vibes implementation detail unless a chapter is separately checked.

### Cursor

Sources checked:

- `https://cursor.com/get-started`
- `https://docs.cursor.com/en/welcome`

Verified page-level statements:

- Cursor publicly describes itself as a coding agent/product.
- Cursor docs cover Agent mode, Rules, MCP, Skills, CLI, models, and related developer workflows.
- Public pages mention Composer model names in page data.

Implication:

- Safe to link Cursor as a product/reference.
- This pass did not verify the imported notes' architectural claims about Composer 2 self-summarization, dynamic tool schema discovery, or exact compaction behavior. Keep those as hypotheses.

## Unverified or downgraded claims

### Google Antigravity SDK

Imported notes mention:

- `google-antigravity` SDK;
- `context_compaction` hook;
- Inspect / Decide / Transform hook taxonomy;
- automatic compaction around ~135k tokens;
- sub-agent delegation APIs.

Result:

- No reachable primary source was verified in this pass.
- These ideas can still inform internal Vibes design, but docs must not present the product/API names or numeric threshold as verified facts.

Recommended wording:

- Use: "Research notes propose an Inspect/Decide/Transform lifecycle taxonomy."
- Avoid: "Google Antigravity SDK exposes `context_compaction` at 135k tokens."

### Claude Code compaction trap reports

Imported notes mention Anthropic/Claude Code auto-compaction bugs and X-thread reports.

Result:

- Community reports were not primary-source verified in this pass.
- The underlying engineering risk is plausible and useful, but cite it as risk framing, not as established product behavior.

Recommended wording:

- Use: "Vendor-side auto-compaction can be risky when summaries lose exact paths, line numbers, and unresolved constraints."
- Avoid: "Claude Code has bug X unless linked to an official issue/release note."

### Morph Compact

Imported notes mention verbatim pruning / masking behavior.

Result:

- No primary source was verified in this pass.
- Keep as an unverified comparator until a repository, paper, or product doc is found.

## Changes applied to local research posture

- `research/notes/google-drive-import-2026-06-16.md` now records that some claims are verified, some remain unverified, and this file is the verification ledger.
- `research/LINKS.md` keeps verified sources and clearly labels community/unverified links.

## Follow-up

- If implementation docs cite Google Antigravity, Morph Compact, or Claude Code-specific failure modes, run another source pass first.
- If the team wants to use exact MiMo thresholds or database schema details, inspect the MiMo source files directly instead of relying on README-level verification.
