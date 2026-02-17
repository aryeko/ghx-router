# Contributing to ghx

Thank you for your interest in contributing to ghx. This document provides guidelines for setting up the development environment and submitting changes.

## Prerequisites

- **Node.js** 22 or later
- **Corepack** (included with modern Node.js)
- **Git**
- **gh CLI** authenticated (`gh auth status`) for CLI-backed flows
- **opencode CLI** only when running E2E suites locally (`pnpm run test:e2e`)

## Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/aryeko/ghx.git
   cd ghx
   ```

2. **Set up the local toolchain**

   ```bash
   ./scripts/setup-dev-env.sh
   ```

   This script enables Corepack and activates the repo's pinned pnpm version.

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Build the project**

   ```bash
   pnpm run build
   ```

## Running Tests

- Run all tests: `pnpm run test`
- Run tests with coverage: `pnpm run test:coverage`
- Run tests for a specific package: `pnpm --filter @ghx-dev/core run test` or `pnpm --filter @ghx-dev/benchmark run test`

## Formatting, Linting, and Type Checking

- Format (auto-fix): `pnpm run format`
- Format (verify): `pnpm run format:check`
- Lint: `pnpm run lint`
- Type check: `pnpm run typecheck`
- Full CI suite (format:check, lint, typecheck, test, build): `pnpm run ci`

## Pre-commit Hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs automatically on commit:

- **Format** - Biome formatting + import sorting (auto-stages fixed files)
- **Lint** - ESLint on staged files
- **Typecheck** - full type check

Hooks are installed automatically by `pnpm install`.

## Additional Checks

- GraphQL codegen drift: `pnpm run ghx:gql:check`
- Benchmark scenario validation: `pnpm --filter @ghx-dev/benchmark run check:scenarios`

## Branch Naming

Use conventional prefixes:

- `feat/` – new features
- `fix/` – bug fixes
- `chore/` – maintenance, refactors, tooling
- `docs/` – documentation only

## Commit Messages

Prefer [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(core): add capability X`
- `fix(benchmark): correct scenario validation`
- `docs: update README quickstart`

For changes that affect the public API or release notes, add a [Changeset](https://github.com/changesets/changesets):

```bash
pnpm run changeset
```

## Pull Request Process

1. Create a branch from `main`
2. Make your changes and ensure `pnpm run ci` passes
3. Add a changeset if the change affects users
4. Open a PR with a clear description
5. Address review feedback

## Detailed Documentation

For comprehensive contributor guides, see [`docs/contributing/`](docs/contributing/README.md):

- [Development Setup](docs/contributing/development-setup.md) — Extended setup and tooling guide
- [Testing Guide](docs/contributing/testing-guide.md) — Test patterns and coverage expectations
- [Code Style](docs/contributing/code-style.md) — Biome, import conventions, type discipline
- [Adding a Capability](docs/contributing/adding-a-capability.md) — Step-by-step guide for new capabilities
- [CI Workflows](docs/contributing/ci-workflows.md) — GitHub Actions pipeline details
- [Publishing](docs/contributing/publishing.md) — Changesets, versioning, and npm publishing

## Questions

Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues) if you have questions.
