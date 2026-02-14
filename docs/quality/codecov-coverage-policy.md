# Codecov Coverage Policy

Coverage is uploaded from package-level Vitest coverage runs.

## Status Targets

Defined in `codecov.yml`:

- Project target: `90%` (threshold `1%`)
- Patch target: `90%`

## Scope

- Only generated GraphQL files are excluded from Codecov status checks:
  - `packages/core/src/gql/generated/**`
  - `packages/core/src/gql/operations/*.generated.ts`

## CI Integration

- PR workflow uploads coverage on Node `24`.
- Main workflow uploads coverage on every push to `main`.
- Codecov upload failures are configured to fail CI.

## Local Verification

```bash
pnpm --filter @ghx-dev/core run test:coverage
pnpm --filter @ghx-dev/benchmark run test:coverage
```
