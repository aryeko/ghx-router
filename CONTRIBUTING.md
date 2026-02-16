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

## Linting and Type Checking

- Lint: `pnpm run lint`
- Type check: `pnpm run typecheck`
- Full CI suite (lint, typecheck, test, build): `pnpm run ci`

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

## Questions

Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues) if you have questions.
