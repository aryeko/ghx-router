# Development Setup

This guide covers cloning the repository, installing dependencies, and configuring your development environment.

## Prerequisites

- **Node.js** 22 or later (check with `node --version`)
- **Corepack** (included with modern Node.js) — manages pnpm
- **Git** — version control
- **gh CLI** authenticated (`gh auth status`) — required for CLI-backed flows
- **pnpm** — installed automatically via Corepack (pinned version in `.npmrc`)

The `opencode` CLI is only required if you plan to run E2E suites locally.

## Clone the Repository

```bash
git clone https://github.com/aryeko/ghx.git
cd ghx
```

## Set Up the Development Environment

The repository uses a pinned version of pnpm managed by Corepack. Run the setup script:

```bash
./scripts/setup-dev-env.sh
```

This script:
1. Enables Corepack
2. Activates the repo's pinned pnpm version
3. Prepares the development toolchain

## Install Dependencies

```bash
pnpm install
```

This installs dependencies for all packages in the monorepo.

## Build the Project

```bash
pnpm run build
```

This compiles TypeScript and builds dist artifacts for all packages.

## Nx Workspace Commands

The monorepo is structured with Nx. Root scripts map to Nx targets and are the preferred local and CI entrypoints.

### Core Commands

- `pnpm run ci` – run full package CI targets (`format:check` + `lint` + `typecheck` + `test:coverage` + `build`)
- `pnpm run ci:affected` – run CI targets only for affected projects
- `pnpm run build` / `pnpm run build:affected`
- `pnpm run format` / `pnpm run format:affected` – auto-fix formatting + import sorting (Biome)
- `pnpm run format:check` / `pnpm run format:check:affected` – verify formatting (CI mode)
- `pnpm run lint` / `pnpm run lint:affected`
- `pnpm run test` / `pnpm run test:affected`
- `pnpm run test:coverage` / `pnpm run test:coverage:affected`
- `pnpm run typecheck` / `pnpm run typecheck:affected`

### Project-Specific Commands

- `pnpm run ghx:gql:check` – enforce generated GraphQL artifacts are in sync
- `pnpm --filter @ghx-dev/benchmark run check:scenarios` – validate benchmark scenarios
- `pnpm run benchmark`, `pnpm --filter @ghx-dev/benchmark run report`, `pnpm --filter @ghx-dev/benchmark run report:gate`

### Utility Commands

- `pnpm run dep-graph` – open Nx dependency graph
- `pnpm run cache:clean` – clear Nx cache

## Environment Variables

### GitHub Token

Many operations require a GitHub personal access token:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
gh auth status  # verify authentication
```

Alternatively, authenticate via the `gh CLI`:

```bash
gh auth login
```

### Worktree Guidance

Feature branches may have isolated worktrees at `.worktrees/<branch-name>/`. Before assuming you're in the active workspace, check for worktrees:

```bash
git worktree list
```

Each worktree is independent and has its own `node_modules`, `.next/`, and Nx cache. Run setup and install commands within the worktree you're working in.

## Verify the Setup

Run the full CI suite to confirm everything is working:

```bash
pnpm run ci
```

This runs formatting checks, linting, type checking, tests, and builds. If it passes, your environment is ready.

## Next Steps

- **Testing:** See [Testing Guide](./testing-guide.md)
- **Code Style:** See [Code Style](./code-style.md)
- **Adding Features:** See [Adding a Capability](./adding-a-capability.md)
