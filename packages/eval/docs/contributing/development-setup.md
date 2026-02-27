# Development Setup

Clone the repository, install dependencies, and verify your development environment.

## Prerequisites

- **Node.js** 22 or later
- **pnpm** (latest stable)
- **git**

## Clone and Install

```bash
git clone https://github.com/aryeko/ghx.git
cd ghx
./scripts/setup-dev-env.sh
pnpm install
pnpm run build
```

## Verify the Eval Build

```bash
pnpm --filter @ghx-dev/eval run build
```

A successful build produces compiled output in `packages/eval/dist/`.

## Run Tests

| Command | Description |
|---------|-------------|
| `pnpm --filter @ghx-dev/eval run test` | Run unit tests |
| `pnpm --filter @ghx-dev/eval run test:coverage` | Run tests with coverage report |

The coverage target is 90% (aim for 95%).

### Run a Single Test

Filter by file path or test name:

```bash
# By file
pnpm --filter @ghx-dev/eval exec vitest run test/unit/scenario/schema.test.ts

# By test name
pnpm --filter @ghx-dev/eval exec vitest run -t "validates scenario schema"

# File + test name
pnpm --filter @ghx-dev/eval exec vitest run test/unit/scenario/schema.test.ts -t "validates"
```

## Lint and Format

| Command | Description |
|---------|-------------|
| `pnpm run format` | Auto-format with Biome |
| `pnpm run format:check` | Check formatting without writing |
| `pnpm run lint` | Run ESLint |
| `pnpm run typecheck` | Run TypeScript type checking |

## Full CI

Run the complete CI pipeline before opening a pull request:

```bash
pnpm run ci --outputStyle=static
```

This runs build, format check, lint, typecheck, and tests across all packages.

## Path Aliases

The package defines the `@eval/*` alias, which maps to `packages/eval/src/*`. Use it for imports that cross two or more directory levels. Single-level relative imports (`./`, `../`) remain as-is.

```typescript
// Cross-directory alias
import { loadScenario } from "@eval/scenario/loader.js"

// Same-directory relative import
import { parseConfig } from "./parse.js"
```

## Related Documentation

- [Contributing Hub](./README.md)
- [Adding Scenarios](./adding-scenarios.md)
- [Architecture](../architecture/README.md)
