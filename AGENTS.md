# AGENTS.md

Operational guide for coding agents working in `ghx`.

## Repository Overview
- Monorepo: `pnpm` + `Nx`.
- Packages:
  - `@ghx-dev/core` (`packages/core`) - CLI-first GitHub execution router.
  - `@ghx-dev/benchmark` (`packages/benchmark`) - benchmark harness/reporting.
- Runtime: Node.js `>=22`.
- Language: TypeScript (`strict`) with ESM (`module`/`moduleResolution` = `NodeNext`).

## Additional Rules Files
Checked in this repo and currently absent:
- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`

If any of these are added later, treat them as required policy inputs.

## Setup
From repo root:

```bash
./scripts/setup-dev-env.sh
pnpm install
```

If tools like `vitest` are missing, install dependencies before running checks.

## Core Commands (Root)
Primary entrypoints (CI parity):

```bash
pnpm run build
pnpm run format:check
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run typecheck
pnpm run ci
```

Affected-only variants:

```bash
pnpm run build:affected
pnpm run format:check:affected
pnpm run lint:affected
pnpm run test:affected
pnpm run test:coverage:affected
pnpm run typecheck:affected
pnpm run ci:affected
```

Formatting (write mode):

```bash
pnpm run format
pnpm run format:affected
```

Useful extras:

```bash
pnpm run ghx:gql:check
pnpm run benchmark
pnpm run benchmark:verify:pr
pnpm run benchmark:verify:release
pnpm --filter @ghx-dev/benchmark run check:scenarios
pnpm --filter @ghx-dev/benchmark run report
pnpm --filter @ghx-dev/benchmark run report:gate
```

## Single-Test Workflows (Vitest)
Use package-filtered Vitest commands for fast targeted runs.

Run one test file:

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
pnpm --filter @ghx-dev/core exec vitest run test/integration/engine-issue-view.integration.test.ts
pnpm --filter @ghx-dev/benchmark exec vitest run test/unit/cli-main.test.ts
```

Run by test name:

```bash
pnpm --filter @ghx-dev/core exec vitest run -t "executeTask"
pnpm --filter @ghx-dev/benchmark exec vitest run -t "benchmark cli mains"
```

Run one file and one test name:

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/run-command.test.ts -t "parses"
```

## Code Style Guidelines

### Formatting and Syntax
- **Biome** is the project formatter (`biome.json` at root). Run `pnpm run format` to auto-fix.
- Enforced style:
  - double quotes
  - no semicolons
  - trailing commas where valid
  - 2-space indentation
  - 100-char line width
- Keep edits minimal and consistent with neighboring files.
- Do not introduce alternative formatters (Prettier, dprint, etc.).

### Imports
- Biome's `organizeImports` assist handles import sorting automatically.
- Use `import type` for type-only imports.
- In ESM files, use explicit `.js` extension in relative imports (enforced by `NodeNext` module resolution).

### Types and Validation
- Preserve strict typing (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Prefer `unknown` + narrowing over `any`.
- Keep public contracts explicit and stable.
- Validate untrusted input at boundaries:
  - core: AJV + JSON schema
  - benchmark: Zod schemas
- Preserve core result envelope shape: `{ ok, data, error, meta }`.

### Naming Conventions
- Files: kebab-case (`map-error.ts`, `safe-runner.ts`).
- Unit tests: `*.test.ts`.
- Integration tests: `*.integration.test.ts`.
- Variables/functions: `camelCase`.
- Types/interfaces: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants.

### Error Handling
- Throw `Error` with actionable messages.
- Avoid silent failures; if catching, either recover explicitly or rethrow with context.
- In routing/execution flows, use shared normalization/mapping helpers.
- Reuse canonical error codes from `packages/core/src/core/errors/codes.ts`.

### Testing Conventions
- Framework: Vitest.
- Keep tests deterministic and isolated.
- Mock external systems (`gh`, network, SDK/session APIs).
- Update or add tests in the same package when behavior changes.
- If GraphQL operations or generated artifacts may change, run `pnpm run ghx:gql:check`.

### Lint/TS Config Notes
- ESLint uses the `strict` preset from `typescript-eslint`.
- `@vitest/eslint-plugin` provides test-specific rules and globals (no manual global declarations needed).
- E2E test files (`*.e2e.test.ts`) have relaxed `no-standalone-expect` and `no-conditional-expect` rules.
- ESLint ignores generated GraphQL files under `packages/core/src/gql/generated/**` and `packages/core/src/gql/operations/*.generated.ts`.
- Respect unused var conventions (`_` prefix is allowed by lint config).
- Build config lives in `tsup.config.ts` per package (not inline in scripts).

### Generated Code
- Treat these as generated artifacts; prefer regeneration over manual edits:
  - `packages/core/src/gql/generated/**`
  - `packages/core/src/gql/operations/*.generated.ts`
- The codegen runner (`scripts/run-gql-codegen.ts`) post-processes generated files to add `.js` extensions to relative imports.

### Pre-commit Hooks
- **Lefthook** runs on pre-commit (`lefthook.yml` at root):
  - Biome format + auto-stage fixed files
  - ESLint on staged `.ts`/`.js`/`.mjs` files
  - Full typecheck
- Hooks are installed automatically via `pnpm install` (lefthook postinstall).

### Dependency Management
- Shared devDependencies are pinned in `pnpm-workspace.yaml` via **pnpm catalog** — use `"catalog:"` in package.json instead of version ranges for: `typescript`, `@types/node`, `tsup`, `tsx`, `vitest`, `@vitest/coverage-v8`.
- **Dependabot** is configured (`.github/dependabot.yml`) for weekly npm and GitHub Actions updates with grouped PRs.
- `.npmrc` enforces `strict-peer-dependencies=true` and `auto-install-peers=false`.

### Documentation Updates
- If architecture/module/file layout changes, update codemaps:
  - `docs/CODEMAPS/ARCHITECTURE.md`
  - `docs/CODEMAPS/MODULES.md`
  - `docs/CODEMAPS/FILES.md`
  - `docs/CODEMAPS/INDEX.md`

## Agent Pre-Handoff Checklist
Before final handoff on substantial changes, run:

```bash
pnpm run ci --outputStyle=static
```

Coverage expectation for touched files: >=90% (aim for 95% when practical).

## PR Template Compliance
Before opening a PR, review `.github/pull_request_template.md` and satisfy every applicable
validation checkbox.

Required checks from the template:

```bash
pnpm run ci --outputStyle=static
```

Conditional checks from the template:
- Run `pnpm run ghx:gql:check` if GraphQL operations changed.
- Confirm tests were added/updated as needed for behavior changes.
