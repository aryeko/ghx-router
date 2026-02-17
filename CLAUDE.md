# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

`ghx` is a GitHub execution router for AI agents — a monorepo (`pnpm` + `Nx`) with two packages:

- `@ghx-dev/core` (`packages/core`) — public npm package; CLI + capability routing engine
- `@ghx-dev/benchmark` (`packages/benchmark`) — private benchmark harness comparing `agent_direct`, `mcp`, and `ghx` execution modes

**Runtime:** Node.js `>=22`. **Language:** TypeScript strict, ESM (`module`/`moduleResolution` = `NodeNext`).

**Worktrees:** Feature branches may have isolated worktrees at `.worktrees/<branch-name>/`. Check there before assuming the main checkout is the active workspace.

## Commands

### Setup
```bash
./scripts/setup-dev-env.sh
pnpm install
```

### Build, Lint, Test (CI parity)
```bash
pnpm run build
pnpm run format:check
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run typecheck
pnpm run ci                     # runs all of the above
pnpm run ci --outputStyle=static  # required before PRs and final handoff
```

Affected-only variants exist for all of the above (e.g. `pnpm run test:affected`).

Format (write mode): `pnpm run format`

### Run a Single Test
```bash
# By file
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
pnpm --filter @ghx-dev/benchmark exec vitest run test/unit/cli-main.test.ts

# By test name
pnpm --filter @ghx-dev/core exec vitest run -t "executeTask"

# File + test name
pnpm --filter @ghx-dev/core exec vitest run test/unit/run-command.test.ts -t "parses"
```

### GraphQL and Benchmark
```bash
pnpm run ghx:gql:check           # verify GraphQL operations (run if .graphql files change)
pnpm run benchmark
pnpm run benchmark:verify:pr
pnpm run benchmark:verify:release
pnpm --filter @ghx-dev/benchmark run check:scenarios
pnpm --filter @ghx-dev/benchmark run report
pnpm --filter @ghx-dev/benchmark run report:gate
```

## Architecture

### Core Execution Flow

```
User/Agent → CLI (packages/core/src/cli/) → executeTask() [core/routing/engine.ts]
           → execute() [core/execute/execute.ts]
           → preflight checks (GITHUB_TOKEN, gh auth)
           → CLI Adapter | GraphQL Adapter | REST Adapter (stub)
           → ResultEnvelope { ok, data, error, meta }
```

1. **CLI entry** (`packages/core/src/cli/index.ts`) dispatches three command families:
   - `run` — parses `task` + `--input` JSON
   - `setup` — installs/verifies `SKILL.md` at `~/.agents/skills/ghx/` or `.agents/` (project scope)
   - `capabilities` — lists/explains capability contracts from operation cards

2. **Operation cards** (`packages/core/src/core/registry/cards/*.yaml`) define each capability: input/output schemas, preferred route, and fallbacks.

3. **Routing engine** (`core/routing/engine.ts` → `core/execute/execute.ts`) loads the card, validates input (AJV + JSON schema), evaluates route suitability, then dispatches to the matching adapter.

4. **Adapters** live in `core/execution/adapters/`. CLI adapter shells out to `gh`/`gh api`; GraphQL adapter runs GitHub GQL queries from `packages/core/src/gql/`.

5. **Public API** — `packages/core/src/index.ts` (library) and `packages/core/src/agent.ts` (agent tools: `listCapabilities`, `createExecuteTool`, `explainCapability`).

### Benchmark Flow

`packages/benchmark/src/cli/benchmark.ts` → scenario selection from `packages/benchmark/scenario-sets.json` → isolated OpenCode sessions → envelope/tool/attempt extraction (`src/extract/`) → assertion validation → `results/*.jsonl` → `reports/latest-summary.{json,md}`.

## Code Style

- **Formatter:** Biome (`biome.json`). Double quotes, no semicolons, trailing commas, 2-space indent, 100-char line width. Do not introduce Prettier or other formatters.
- **Imports:** Use `import type` for type-only imports. Relative imports require explicit `.js` extension (NodeNext resolution). When a module needs both a value and a type import from the same source, Biome's `organizeImports` places `import type` first — accept this ordering to avoid churn.
- **Types:** `unknown` + narrowing over `any`. Validate untrusted input at boundaries (AJV in core, Zod in benchmark). Result envelope shape `{ ok, data, error, meta }` is a stable contract — do not change it.
- **Error codes:** Reuse from `packages/core/src/core/errors/codes.ts`.
- **`mapErrorToCode` ordering:** In `core/errors/map-error.ts`, Auth must precede Validation (both match "invalid…" messages). Current order: RateLimit → Server → Network → NotFound → Auth → Validation → Unknown.
- **Files:** kebab-case. Tests: `*.test.ts` (unit), `*.integration.test.ts` (integration). Types: PascalCase. Constants: `UPPER_SNAKE_CASE`.
- **`exactOptionalPropertyTypes: true`** is set in tsconfig. Zod's `.optional()` infers `T | undefined`, which conflicts with TypeScript's strict optional semantics. When returning Zod-parsed values where the declared return type uses optional fields (`field?: T`), cast the result (e.g. `as Promise<BenchmarkRow[]>`).
- **Generated code:** Never edit manually — `packages/core/src/gql/generated/**` and `packages/core/src/gql/operations/*.generated.ts`. Regenerate via codegen script.

## Pre-commit Hooks

Lefthook runs automatically on commit (installed via `pnpm install`):
- Biome format + auto-stage
- ESLint on staged `.ts`/`.js`/`.mjs`
- Full typecheck

**Caution:** Lefthook's `stage_fixed: true` auto-stages all Biome-modified files. Avoid parallel commits in the same worktree — stray unstaged files bleed into the wrong commit.

## Pre-PR Checklist

1. `pnpm run ci --outputStyle=static` passes.
2. If GraphQL operations changed: `pnpm run ghx:gql:check`.
3. Satisfy all applicable checkboxes in `.github/pull_request_template.md`.
4. Coverage for touched files: ≥90% (aim for 95%).
5. If `@ghx-dev/core` public API changed: add a changeset — create `.changeset/<kebab-name>.md` with frontmatter `---\n"@ghx-dev/core": patch\n---\n\nDescription.`

## Documentation

Documentation hub: `docs/README.md`. Key sections:
- `docs/architecture/` — system-design, routing-engine, operation-cards, adapters, agent-interface, repository-structure, telemetry
- `docs/capabilities/` — per-domain capability reference (issues, PRs, workflows, releases, etc.)
- `docs/getting-started/` — installation, first-task, setup-for-agents, how-it-works
- `docs/guides/` — CLI usage, library API, agent integration, result envelope, error handling, routing explained
- `docs/benchmark/` — methodology, running benchmarks, scenario authoring, metrics, reporting
- `docs/contributing/` — development setup, testing, code style, adding capabilities, CI, publishing

If architecture, module, or file layout changes, update `docs/architecture/repository-structure.md`.
