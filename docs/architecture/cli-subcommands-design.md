# CLI Subcommands Design: Setup + Capabilities Discovery

**Status:** Planned  
**Date:** 2026-02-14  
**Audience:** Core CLI maintainers

---

## 1) Motivation

`ghx` currently exposes a narrow CLI surface (`ghx run ...`) while the runtime already has rich capability introspection APIs (`listCapabilities`, `explainCapability`). Adoption depends on discoverability and easy setup, so the CLI needs:

- first-class capability discovery commands,
- a setup command for initial skill installation,
- a command architecture that can scale beyond one-off manual parsing.

---

## 2) Goals

1. Add user-facing subcommands for capability discovery:
   - `ghx capabilities list`
   - `ghx capabilities explain <capability_id>`
2. Add setup subcommand:
   - `ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]`
3. Reuse existing agent-interface tool logic for capability metadata.
4. Document CLI framework options and recommend a migration path.

## 3) Non-goals

- Full migration to a third-party CLI framework in this batch.
- Interactive wizard flows beyond overwrite confirmation.
- Setup orchestration outside skill installation.

---

## 4) Command Contracts

### 4.1 `ghx capabilities list`

- Default output: text rows (`<capability_id> - <description>`)
- Option: `--json` emits JSON array.

### 4.2 `ghx capabilities explain <capability_id>`

- Default output: pretty JSON for human readability.
- Option: `--json` emits compact JSON.
- Unknown capability returns exit code 1 with actionable error.

### 4.3 `ghx setup --scope <user|project> ...`

- `--scope` required.
- `--dry-run` prints planned write path only.
- `--verify` checks install state only.
- `--yes` skips overwrite prompt.
- `--track` logs local setup telemetry event.

---

## 5) CLI Framework Research

### 5.1 Candidate libraries

| Library | Pros | Cons | Fit |
|---|---|---|---|
| `cac` | Lightweight, ESM-friendly, simple nested subcommands, good TS ergonomics | Smaller ecosystem than commander | **Recommended** for near-term migration |
| `commander` | Mature, broad ecosystem, rich option support | Heavier API surface, more boilerplate | Good if advanced command features are needed soon |
| `clipanion` | Strong typing model, powerful command abstractions | Higher complexity and migration cost | Better for very large CLIs |
| Manual parsing (current) | Zero dependency, full control | Harder to scale, repetitive parsing/usage logic | Acceptable short-term, weaker long-term |

### 5.2 Recommendation

- Keep manual parsing for this batch to minimize churn.
- Plan follow-up migration to `cac` once command surface expands beyond setup + capabilities + run.

---

## 6) Requirements

### 6.1 Functional requirements

1. New subcommands are reachable from top-level `main()` dispatch.
2. Capability commands consume `listCapabilities`/`explainCapability` and do not duplicate registry logic.
3. Setup command writes skill file into `.agents/skills/ghx/SKILL.md` for selected scope.
4. Setup command prompts before overwriting existing skill file unless `--yes` is provided.

### 6.2 Quality requirements

1. Usage output lists all supported command forms.
2. Command errors return non-zero exit and clear message.
3. `--json` output is valid JSON without extra formatting noise.

### 6.3 Safety requirements

1. Setup does not overwrite existing skill content without explicit approval.
2. `--track` is opt-in; no setup telemetry is emitted without it.
3. Setup telemetry includes only setup event metadata (no secrets, no tool-call data).

---

## 7) Validation Plan

### 7.1 Unit validation

- CLI index dispatch tests for `setup` and `capabilities` commands.
- Capabilities command tests for text/json output and error handling.
- Setup tests for scope behavior, verify, dry-run, overwrite protection, and telemetry gating.

### 7.2 Integration validation

- End-to-end CLI invocation tests in core package for top-level command routing.

### 7.3 Release-gate commands

```bash
pnpm --filter @ghx-dev/core run typecheck
pnpm --filter @ghx-dev/core run lint
pnpm --filter @ghx-dev/core run test
```

---

## 8) Acceptance Criteria

1. `ghx capabilities list/explain` are shipped and documented.
2. `ghx setup` works for `user` and `project` scopes and supports dry-run/verify/track.
3. Overwrite protection is enforced by prompt or `--yes`.
4. Test suite covers new command surface and passes.
