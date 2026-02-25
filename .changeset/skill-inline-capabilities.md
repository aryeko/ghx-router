---
"@ghx-dev/core": patch
---

Inline full capabilities list in SKILL.md, replacing the discovery section.

Agents no longer need to call `ghx capabilities list` at the start of each session — all 70 capabilities are available in the skill prompt. This saves one LLM round-trip (~3.5s latency, ~3.8k tokens) per session. `ghx capabilities explain` is retained for detailed schema lookups.
