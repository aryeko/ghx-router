# AGENTS.md

Operational guide for coding agents working in `ghx`.

## Instruction Priority
- Follow user instructions first.
- Then follow this file.
- Then follow local code/config conventions.

## Repository Overview
- Monorepo: `pnpm` + `Nx`.
- Packages:
  - `@ghx-dev/core` (`packages/core`) - CLI-first GitHub execution router.
  - `@ghx-dev/benchmark` (`packages/benchmark`) - benchmark harness/reporting.
- Language/runtime: TypeScript on Node.js, ESM modules.

## Additional Rules Files
Checked and currently absent: `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`.
If any appear later, treat them as required policy inputs.

## Setup
Run once from repo root:

```bash
pnpm install
```

If you see missing tool errors (for example `vitest: command not found`), install dependencies before running tests.

## Core Commands (Root)
Preferred entrypoints for local checks and CI parity:

```bash
pnpm run build
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run typecheck
pnpm run ci
```

Affected-only variants:

```bash
pnpm run build:affected
pnpm run lint:affected
pnpm run test:affected
pnpm run test:coverage:affected
pnpm run typecheck:affected
pnpm run ci:affected
```

Project-specific checks:

```bash
pnpm run ghx:gql:check
pnpm run benchmark:check
pnpm run benchmark:run
pnpm run benchmark:report
pnpm run benchmark:gate
```

## Single-Test Workflows (Vitest)
Use package-filtered Vitest commands for targeted runs.

Run one test file:

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
pnpm --filter @ghx-dev/benchmark exec vitest run test/unit/cli-main.test.ts
```

Run by test name:

```bash
pnpm --filter @ghx-dev/core exec vitest run -t "executeTask engine wiring"
pnpm --filter @ghx-dev/benchmark exec vitest run -t "benchmark cli mains"
```

Run one file and one test name together:

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/run-command.test.ts -t "parses"
```

Package coverage commands:
- `pnpm --filter @ghx-dev/core run test:coverage`
- `pnpm --filter @ghx-dev/benchmark run test:coverage`

## Code Style Guidelines

### Formatting and Syntax
- Match existing style in repo:
  - double quotes
  - no semicolons
  - trailing commas where valid
  - 2-space indentation
- No dedicated Prettier config is present; stay consistent with nearby files.

### Imports
- Keep imports grouped in stable order:
  1. external packages
  2. Node built-ins (`node:*`)
  3. local relative imports
- Use `import type` for type-only imports.
- In this ESM repo, use explicit `.js` extension in relative imports.

### Types and Validation
- `strict` TypeScript is enabled; do not weaken type safety.
- Prefer `unknown` + narrowing over `any`.
- Validate untrusted input at boundaries:
  - core: AJV + JSON schema for cards/input/output
  - benchmark: Zod for scenario validation
- Preserve core envelope contract: `{ ok, data, error, meta }`.

### Naming Conventions
- File names: kebab-case (`map-error.ts`, `safe-runner.ts`).
- Unit tests: `*.test.ts`.
- Integration tests: `*.integration.test.ts`.
- Variables/functions: `camelCase`.
- Types/interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants.

### Error Handling
- Throw `Error` with clear, actionable messages.
- Do not silently swallow errors.
- In router/execution flows, use shared error normalization/mapping.
- Reuse canonical error codes in `packages/core/src/core/errors/codes.ts`.

### Testing Conventions
- Framework: Vitest.
- Keep tests deterministic and isolated.
- Mock external dependencies (`gh`, network, SDK/session APIs).
- When changing behavior, update/add tests in the same package.
- If GraphQL operations change, run `pnpm run ghx:gql:check`.

### Generated Code
- Treat as generated artifacts:
  - `packages/core/src/gql/generated/**`
  - `packages/core/src/gql/operations/*.generated.ts`
- Prefer regenerating over manual edits.

### Documentation Updates
- If architecture/module/file layout changes, update codemaps:
  - `docs/CODEMAPS/ARCHITECTURE.md`
  - `docs/CODEMAPS/MODULES.md`
  - `docs/CODEMAPS/FILES.md`
  - `docs/CODEMAPS/INDEX.md`

## Agent Pre-Handoff Checklist
Before final handoff on substantial changes, run:

```bash
pnpm run ci:affected --parallel=3 --outputStyle=static
pnpm run test:coverage --parallel=3 --outputStyle=static  # <-- verify all modified or new files has >=90% coverage (aim for 95)
```
