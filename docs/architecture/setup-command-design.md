# Setup Command Design: `ghx setup` Skill Installer

**Status:** Planned  
**Date:** 2026-02-14  
**Audience:** Core CLI maintainers, OSS maintainers

---

## 1) Motivation

`ghx` adoption depends on reducing install friction. For the first implementation, setup should be intentionally narrow: install a reusable skill file that teaches users/agents to call `ghx` capabilities directly.

This avoids complex config orchestration while still delivering fast time-to-first-value.

---

## 2) Goals

1. Install ghx skill assets for a selected scope (`user` or `project`).
2. Support verification and dry-run before mutating files.
3. Protect existing skill files with explicit overwrite approval.
4. Emit setup telemetry only when explicitly requested (`--track`).

## 3) Non-goals

- Platform-specific settings/hook patching in v1.
- Profile systems (`--profile`) in v1.
- Running user and project installation in one command invocation.

---

## 4) CLI Contract

```bash
ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]
```

Flags:

- `--scope`: required target scope.
- `--yes`: bypass overwrite prompt.
- `--dry-run`: show intended write path only.
- `--verify`: check installed skill state only (no writes).
- `--track`: opt-in local setup telemetry event.

---

## 5) Install Targets

- `user` scope: `$HOME/.agents/skill/ghx/SKILL.md`
- `project` scope: `<repo>/.agents/skill/ghx/SKILL.md`

`project` and `user` installs are executed separately; each command run writes to one target path only.

---

## 6) Skill Content Requirements

Installed skill text must include:

1. purpose statement for ghx capability execution,
2. command references:
   - `ghx capabilities list`
   - `ghx capabilities explain <capability_id>`
   - `ghx run <capability_id> --input '<json>'`
3. one concrete invocation example.

---

## 7) Overwrite and Safety Model

1. If `SKILL.md` does not exist, write directly.
2. If it exists and `--yes` is not set:
   - prompt for overwrite approval when interactive,
   - fail with actionable message in non-interactive mode.
3. If overwrite denied, exit non-zero and keep existing file unchanged.

No silent overwrite behavior is allowed.

---

## 8) Verification Model

`ghx setup --verify` validates:

1. target skill file exists,
2. file contains expected ghx usage markers.

Output:

- PASS: `Verify passed: ...`
- FAIL: `Verify failed: ...` with exact path.

---

## 9) Telemetry Model (`--track` only)

Telemetry is opt-in and local-only in v1.

- event file: `$HOME/.agents/ghx/setup-events.jsonl`
- event fields: command, scope, mode (`apply`/`verify`/`dry-run`), success flag, timestamp.

No telemetry event is written unless `--track` is provided.

---

## 10) Requirements

### 10.1 Functional requirements

1. Setup succeeds for both scopes.
2. `--dry-run` performs no writes.
3. `--verify` performs no writes.
4. Existing file overwrite requires approval unless `--yes` is set.
5. Setup output includes next-step command (`ghx capabilities list`).

### 10.2 Quality requirements

1. Command output is concise and actionable.
2. Error messages include exact failing path.
3. Re-running with same inputs is deterministic.

### 10.3 Safety requirements

1. No silent overwrite of existing skill files.
2. No telemetry without `--track`.
3. No secrets or sensitive values in telemetry payload.

---

## 11) Validation Plan

### 11.1 Unit validation

- scope parsing and usage errors,
- dry-run and verify behavior,
- skill write path resolution for user/project,
- overwrite guard behavior,
- telemetry gating for `--track`.

### 11.2 Integration validation

- fixture directory integration tests for both scopes.

### 11.3 Release-gate commands

```bash
pnpm --filter @ghx/core run typecheck
pnpm --filter @ghx/core run lint
pnpm --filter @ghx/core run test
```

---

## 12) Acceptance Criteria

1. `ghx setup` installs `SKILL.md` in target scope.
2. `ghx setup --verify` passes after install and fails before install.
3. Overwrite requires confirmation or `--yes`.
4. Setup telemetry appears only with `--track`.
