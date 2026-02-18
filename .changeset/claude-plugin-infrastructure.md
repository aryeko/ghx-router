---
"@ghx-dev/core": minor
---

Add Claude Code plugin infrastructure for native plugin installation.

- Move skill to `skills/using-ghx/SKILL.md` with plugin frontmatter, serving both `ghx setup` and Claude Code plugin
- Add `.claude-plugin/plugin.json` (package) and `.claude-plugin/marketplace.json` (repo root)
- Add `sync-plugin-manifests.mjs` to generate plugin manifests from `package.json` with `--check` mode for CI
- Remove redundant `dist/skills` copy (skills ship via `files` array at package root)
