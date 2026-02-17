# Testing Guide

This guide covers running tests, understanding test types, and maintaining coverage targets.

## Running Tests

### All Tests

```bash
pnpm run test
```

Run all tests across all packages.

### With Coverage Report

```bash
pnpm run test:coverage
```

Generates coverage reports for all packages. Coverage data is uploaded to Codecov during CI.

### By Package

```bash
pnpm --filter @ghx-dev/core run test
pnpm --filter @ghx-dev/benchmark run test
```

### By File

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
pnpm --filter @ghx-dev/benchmark exec vitest run test/unit/cli-main.test.ts
```

### By Test Name

```bash
pnpm --filter @ghx-dev/core exec vitest run -t "executeTask"
```

### By File and Test Name

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/run-command.test.ts -t "parses"
```

## Test Types

### Unit Tests

Located in `test/unit/` directories. These test individual functions and modules in isolation.

Example:
```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```

### Integration Tests

Located with `*.integration.test.ts` suffix. These test multiple modules working together.

### E2E Tests

End-to-end tests require the `opencode` CLI. Run locally only when needed:

```bash
pnpm run test:e2e  # (requires opencode CLI)
```

## Coverage Targets

Coverage is measured per-package and must meet these targets:

- **Project coverage:** ≥90% (threshold: 1%)
- **Patch coverage:** ≥90%

### Configuration

Coverage targets are defined in `codecov.yml`:

```yaml
coverage:
  precision: 2
  round: down
  range:
    - 85
    - 100
  status:
    project:
      default:
        target: 90%
        threshold: 1%
    patch:
      default:
        target: 90%
```

### Excluded from Coverage

Only generated GraphQL files are excluded from Codecov status checks:
- `packages/core/src/gql/generated/**`
- `packages/core/src/gql/operations/*.generated.ts`

Non-code changes (documentation, configuration) are treated as successful if no coverage artifacts are found.

## Local Coverage Verification

Before submitting a PR, verify coverage locally:

```bash
pnpm --filter @ghx-dev/core run test:coverage
pnpm --filter @ghx-dev/benchmark run test:coverage
```

View the HTML coverage report (generated in each package's `coverage/` directory):

```bash
open packages/core/coverage/index.html
open packages/benchmark/coverage/index.html
```

## Test Patterns

The codebase uses these testing patterns:

### Input Validation

Tests validate schema enforcement using AJV (core) and Zod (benchmark):

```typescript
it("validates input against schema", async () => {
  const result = await execute({ invalid: "input" })
  expect(result.ok).toBe(false)
  expect(result.error).toMatch(/validation/)
})
```

### Error Handling

Tests verify error codes and mapping via `mapErrorToCode`:

```typescript
it("maps network errors correctly", async () => {
  const error = new Error("ECONNREFUSED")
  expect(mapErrorToCode(error)).toBe("NETWORK_ERROR")
})
```

### Result Envelope

All operations return a stable envelope shape: `{ ok, data, error, meta }`:

```typescript
interface ResultEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
  meta?: Record<string, unknown>
}
```

## CI Coverage Integration

### Upload Behavior

- **PR workflow:** Uploads coverage on Node 24
- **Main workflow:** Uploads coverage on every push to `main`
- **Upload failures:** Configured to fail CI

### Pre-commit Hooks

[Lefthook](https://github.com/evilmartians/lefthook) automatically runs on commit:
- Full type check
- ESLint on staged files
- Biome format (auto-stages fixed files)

## Tips for Maintaining Coverage

1. **Aim for 95%:** The target is 90%, so aiming higher provides a buffer.
2. **Test error paths:** Include tests for error conditions, not just happy paths.
3. **Mock external dependencies:** Use Vitest's mocking for network calls, file I/O, etc.
4. **Test async behavior:** Use async/await patterns in tests for proper error handling.
5. **Avoid skipping tests:** Pending tests (`it.skip`, `describe.skip`) reduce coverage.

## Next Steps

- **Code Style:** See [Code Style](./code-style.md)
- **CI Workflows:** See [CI Workflows](./ci-workflows.md)
- **Adding a Capability:** See [Adding a Capability](./adding-a-capability.md)
