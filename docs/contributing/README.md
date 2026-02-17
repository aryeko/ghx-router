# Contributing to ghx

Thank you for your interest in contributing to ghx. This hub provides guidance for setting up your development environment, writing code, running tests, and shipping changes.

## Contribution Workflow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#666', 'primaryTextColor': '#fff', 'primaryBorderColor': '#444', 'lineColor': '#999'}}}%%
graph LR
    A["Setup<br/>(Clone & Install)"] --> B["Develop<br/>(Edit & Test)"]
    B --> C["Ship<br/>(Review & Merge)"]
    style A fill:#666,stroke:#444,color:#fff
    style B fill:#666,stroke:#444,color:#fff
    style C fill:#666,stroke:#444,color:#fff
```

## Documentation

| Topic | Purpose |
|-------|---------|
| [Development Setup](./development-setup.md) | Clone, install, prerequisites (Node 22+, pnpm, gh CLI) |
| [Testing Guide](./testing-guide.md) | Running tests, coverage targets (90% project/patch), test patterns |
| [Code Style](./code-style.md) | Biome formatter, import conventions, file naming, error codes |
| [CI Workflows](./ci-workflows.md) | PR and main branch automation, release triggers |
| [Publishing](./publishing.md) | Changesets, versioning, npm release process |
| [Adding a Capability](./adding-a-capability.md) | Step-by-step guide to adding new operations |

## Quick Reference

### Setup & Build

```bash
git clone https://github.com/aryeko/ghx.git
cd ghx
./scripts/setup-dev-env.sh
pnpm install
pnpm run build
```

### Development

```bash
pnpm run format                 # Auto-fix formatting & imports (Biome)
pnpm run lint                   # Lint with ESLint
pnpm run typecheck              # Full type check
pnpm run test                   # Run all tests
pnpm run test:coverage          # Tests with coverage report
pnpm run ci                     # Full CI suite (format:check, lint, typecheck, test, build)
```

### Before Submitting a PR

```bash
pnpm run ci --outputStyle=static
pnpm run ghx:gql:check          # If GraphQL operations changed
pnpm run changeset              # If adding a user-facing change
```

### Testing Specifics

```bash
# By file
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts

# By test name
pnpm --filter @ghx-dev/core exec vitest run -t "executeTask"

# By package
pnpm --filter @ghx-dev/core run test
pnpm --filter @ghx-dev/benchmark run test
```

### Git & Commits

Branch naming:
- `feat/` – new features
- `fix/` – bug fixes
- `chore/` – maintenance, refactors, tooling
- `docs/` – documentation only

Use [Conventional Commits](https://www.conventionalcommits.org/):
```text
feat(core): add capability X
fix(benchmark): correct scenario validation
docs: update README
```

## Pre-commit Hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs automatically on commit:
- **Format** – Biome formatting + import sorting (auto-stages fixed files)
- **Lint** – ESLint on staged files
- **Typecheck** – full type check

## Questions

Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues) if you have questions.
