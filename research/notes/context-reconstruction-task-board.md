---
type: implementation-plan
tags: [vibes, multi-agent, context-reconstruction, task-board]
created: 2026-06-16
source: bootstrap-project-prompt.md + gdrive research import
status: seeded
---

# Context Reconstruction Upgrade — Multi-Agent Task Board

This board seeds a major Vibes upgrade as a decentralized multi-agent test. Use manifest mode for the first pass: each worker claims exactly one task, locks listed files, verifies locally, completes, and unlocks.

## Worker command

```bash
cd /home/stephen/projects/ai-agent-teamwork/projects/vibes
python3 scripts/tasks.py list --status pending
python3 scripts/tasks.py claim task-XXX
# work only the claimed task/files
npm run build
python3 scripts/tasks.py verify-complete task-XXX
```

## Task sequence

1. Architecture/docs/audit tasks can run first: task-001, task-002, task-012.
2. Independent implementation foundations after docs/audit: task-003, task-004, task-005, task-008, task-009.
3. Integration layer: task-006 then task-007.
4. Final docs and E2E: task-010 and task-011.

## Non-negotiables

- Default behavior must remain unchanged unless a feature flag is enabled.
- Preserve file paths, line numbers, and error headers verbatim during compaction.
- Do not cite unverified transcript/Drive claims as facts in public docs.
- Run `npm run build` before completing any code task.
