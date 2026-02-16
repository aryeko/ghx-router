# Setup Command Guide: `ghx setup`

Install a ghx skill file so AI coding agents discover and use ghx capabilities without manual prompting.

## Context

AI coding agents (Claude Code, Cursor, Copilot, OpenCode, etc.) interact with GitHub through the `gh` CLI or raw API calls. Without upfront guidance, agents waste significant tokens rediscovering CLI flags, parsing unstructured output, and recovering from hallucinated commands.

ghx solves this at the runtime layer -- typed capabilities, deterministic routing, stable result envelopes -- but agents still need to *know ghx exists* before they can use it. That is what `ghx setup` addresses.

## Motivation

The setup command exists to close the **last-mile adoption gap**:

1. **Discovery.** An agent landing in a repository has no reason to reach for `ghx` unless something in its context mentions it. A skill file placed in the agent's search path solves this passively.
2. **Bootstrapping.** The skill file teaches the session bootstrap (`gh auth status` and `ghx capabilities list`) plus the execution flow (`capabilities explain`, `run`) -- enough to become productive in one read.
3. **Zero-config onboarding.** Running a single command is faster and less error-prone than manually creating files, and it keeps the skill content versioned with the CLI itself.

## What it installs

`ghx setup` writes a single file: `SKILL.md`. This is a compact Markdown document that agents parse as a "skill" -- a structured instruction set describing how to use a tool.

The skill content includes:

- A purpose statement for ghx capability execution.
- A session bootstrap block (`gh auth status`, then `ghx capabilities list`).
- A command workflow (`capabilities explain` before `run` when input shape is unclear).
- Result-envelope handling rules (`ok`, `data`, `error`, `meta`) and retry guidance.
- Neutral example invocations (`octocat` / `hello-world`).

No binaries, no config files, no environment mutations -- just one Markdown file.

### Install locations

| Scope | Path | Use case |
|-------|------|----------|
| `user` | `~/.agents/skills/ghx/SKILL.md` | Personal machine; all projects pick it up |
| `project` | `<cwd>/.agents/skills/ghx/SKILL.md` | Repository-scoped; shared via version control |

Each invocation writes to exactly one path. To install both, run the command twice with different `--scope` values.

## Usage

### Install (user scope)

```bash
ghx setup --scope user
```

### Install (project scope, non-interactive)

```bash
ghx setup --scope project --yes
```

### Preview without writing

```bash
ghx setup --scope user --dry-run
```

### Verify an existing installation

```bash
ghx setup --scope project --verify
```

### Enable local telemetry

```bash
ghx setup --scope user --track
```

Appends a setup event to `~/.agents/ghx/setup-events.jsonl`. Events are local-only and opt-in.

## CLI reference

```
ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--scope <user\|project>` | Yes | Where to install the skill file |
| `--yes` | No | Skip overwrite confirmation if the file already exists |
| `--dry-run` | No | Print the target path without writing anything |
| `--verify` | No | Check that the skill is installed and contains expected content |
| `--track` | No | Append a setup event to the local telemetry log |

`--scope` accepts both `--scope user` and `--scope=user` forms.

## Safety model

- **No silent overwrites.** If `SKILL.md` already exists and `--yes` is not set, the command prompts for confirmation in interactive terminals. In non-interactive environments (CI, piped input), it fails with an actionable error message.
- **No writes in verify or dry-run mode.** These flags are read-only by design.
- **No telemetry without opt-in.** The `--track` flag must be explicitly provided; no data is collected otherwise.

## Typical workflows

### Personal machine setup

```bash
npm i -g @ghx-dev/core
ghx setup --scope user --yes
```

Every agent session on this machine now has access to ghx capabilities.

### Project onboarding (checked into repo)

```bash
ghx setup --scope project --yes
git add .agents/skills/ghx/SKILL.md
git commit -m "add ghx agent skill"
```

Team members and CI agents pick up ghx automatically when they clone the repo.

### CI verification

```bash
ghx setup --scope project --verify
```

Use this in CI to assert the skill file is present and valid before running agent-driven workflows.

## Known limitations and improvement opportunities

The current implementation is solid for v1. The following items are tracked for future iterations:

### `--verify` does not detect stale skills

Verification checks only that the file contains the substring `"ghx capabilities"`. It does not detect whether the installed skill matches the current CLI version. A content hash or embedded version marker would allow `--verify` to warn when the skill is outdated -- valuable for CI gates after upgrades.

### Duplicated ENOENT error-handling pattern

`verifySkill` and `skillFileExists` share identical error-narrowing logic for ENOENT vs other FS errors. Extracting an `isEnoent(error): boolean` helper would reduce duplication and keep things consistent as more FS operations are added.

### No uninstall path

Users can install but not cleanly remove. A `--remove` flag (or documented manual removal path) would complete the lifecycle. Low priority since the file is a single Markdown document, but a nice quality-of-life addition.

### No `-y` short flag

Most CLIs provide `-y` as a shorthand for `--yes`. Minor ergonomic gap.

### AJV instantiated at module scope

`new Ajv()` is created at import time, meaning any command that imports the CLI entry point pays the initialization cost. The setup options schema (5 boolean/enum fields already structurally guaranteed by `parseArgs`) could be validated with a simple type guard instead. If AJV is already loaded for the `run` command path this is a non-issue; otherwise it is unnecessary overhead.

### `--dry-run` does not preview content

Dry-run prints only the target path. Showing the skill content (or supporting `--dry-run --verbose`) would give users full visibility before committing.

## Related

- [Architecture: Setup Command Design](../architecture/setup-command-design.md) -- internal design doc and acceptance criteria.
- [Architecture: Agentic Interface](../docs_design_agentic-interface.md) -- why agents need a stable tool surface.
- [Architecture: Agent Interface Tools](../architecture/agent-interface-tools.md) -- the runtime tools the skill file teaches agents to use.
