---
type: research-note
tags: [vibes, agents, ecosystem, reference-index]
created: 2026-06-16
source: "AI Agents, Harnesses, and Parallel Projects Reference Index"
status: imported-from-google-drive-export
---

# AI Agents, Harnesses, and Parallel Projects Reference Index

## Source
- Google Drive export: `gdrive/ai-agents-harnesses-list.md`
- Google Drive document name: `AI Agents, Harnesses, and Parallel Projects Reference Index`
- Local transcript: `gemini_chat.txt`
- Transcript anchor: gemini_chat.txt lines 683-693
- Referenced links:
  - https://x.com/i/status/2066185785204719769

## Summary
Additional Drive document found in the transcript: an ecosystem landscape index of AI agents, harnesses, and related projects extracted from the X discussion.

## Key takeaways
- Organizes related tools by functional category.
- Focuses on context retention, routing, and multi-model execution loops.
- Cross-references how each project may inform Vibes architecture.

## Vibes implementation implications
- Use as the master competitor-research backlog.
- Populate one `research/github-projects/*.md` note per confirmed external repo.

## Caveats / verification needed
- Imported from gemini_chat.txt / user-provided Drive document names; claims should be verified against primary sources before implementation decisions.

## Follow-up questions
- Which ideas should become ADRs versus experiments?
- Which claims require direct source validation before coding?

## Full Google Drive export

_Source file: `gdrive/ai-agents-harnesses-list.md`_

# List of AI Agents, Harnesses, and Related Projects

From comments on https://x.com/i/status/2066185785204719769

## Directly Referenced Projects/Tools:

- **Pi** (and variants like Pi-native agents, oh-my-pi): Open-source coding harness. People build personal harnesses on top, including extensions for model fusion.

- **smallharness** (@smallharness by Morgan): Similar setup.

- **AthenaCode / Athena** (by Luckey Faraday / @luckeyfaraday): Context-aware coding tool with session recall. Open-source fork.

- **SoulForge** (@BniWael / ProxySoul): GitHub - https://github.com/proxysoul/soulforge. Multi-model/harness features.

- **HermesFusion** (by @giannoklein): Bring-your-own-model fusion runner. Repo: https://github.com/GiannoKlein9/HermesFusion.

- **Z Protocol** (@_zprotocol): Consumer-friendly personal AI harnesses with private inference, routing, etc.

- **Cerver.ai** (@EyalTweets): Session layer for agents calling each other. Supports local/cloud models.

- **Vellum.ai** (@vellum_ai / @anitakirkovska): Primitives for customizing your own harness.

- **Pi extension for fusion** (by @huntsyea): Custom extension for fusion with authed models.

- **trySquad.ai** (@ShafanKhan_ / @trySquadHQ): Building personal harness capabilities.

- **Vibes TUI** (@HappyMonkeyAI): Coding with small local LLM models. GitHub: https://github.com/HappyMonkeyAI/vibes.

- **Runie** (@butaji): Harness focused on token budget optimization, multi-model routing, dynamic workflows.

## Other Mentions:
- Custom skills/gists for Claude OAuth.
- Personal harnesses, SWE-agent, Pareto router, OpenRouter Fusion integrations.
- Many DIY Pi + OpenRouter setups.

*Last updated: June 2026*  
*Source thread on X*
