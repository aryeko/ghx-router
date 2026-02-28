# Managing Fixtures

How to seed, verify, and clean up GitHub test fixtures for reproducible evaluations.

## Overview

Fixtures are managed GitHub resources -- PRs, issues, branches, labels -- in a dedicated benchmark repository. They provide identical starting conditions for every evaluation iteration across all three modes (ghx, mcp, baseline).

Fixture lifecycle: **seed** (create resources) -> **status** (verify they exist) -> **cleanup** (remove after evaluation). Reset between iterations is handled automatically by internal hooks.

## Fixture Manifest

The manifest file tracks all seeded fixtures and their resource identifiers. It lives at the path configured in `eval.config.yaml` (default: `fixtures/latest.json`) and is gitignored.

```typescript
interface FixtureManifest {
  seedId: string                         // Identifier for the seed run
  createdAt: string                      // ISO-8601 timestamp
  repo: string                           // "owner/repo" format
  fixtures: Record<string, FixtureResource>
}

interface FixtureResource {
  type: string                           // e.g. "pr_with_changes"
  number: number                         // PR or issue number
  repo: string                           // Full "owner/repo" path
  branch?: string                        // Branch name (for PRs)
  labels?: string[]                      // Applied labels
  metadata: Record<string, unknown>      // e.g. { originalSha: "abc123" }. Default: {}
}
```

Example manifest:

```json
{
  "seedId": "default",
  "createdAt": "2026-02-27T12:00:00Z",
  "repo": "aryeko/ghx-bench-fixtures",
  "fixtures": {
    "pr_with_changes": {
      "type": "pr_with_changes",
      "number": 43,
      "repo": "aryeko/ghx-bench-fixtures",
      "branch": "bench-fixture/pr-changes-43",
      "labels": ["bench-fixture"],
      "metadata": {
        "filesChanged": 3,
        "additions": 25,
        "deletions": 10
      }
    }
  }
}
```

## Seeding Fixtures

Seeding creates all fixtures required by the selected scenarios. Use the CLI seeder; manual manifest editing is a fallback for custom workflows.

```bash
pnpm --filter @ghx-dev/eval run eval fixture seed
```

The seeder:
1. Loads scenario files and collects all unique `fixture.requires` entries
2. Creates branches, commits, PRs/issues as needed in the fixture repo
3. Labels all resources with `"bench-fixture"` for discovery
4. Writes the manifest to `fixtures/latest.json`

If `seed_if_missing: true` is set in config, `eval run` will auto-seed when the manifest is not found.

## Checking Status

Verify that all required fixtures exist and are in the expected state:

```bash
pnpm --filter @ghx-dev/eval run eval fixture status
```

Output reports each fixture as OK, MISSING, or STALE, with a summary line (e.g. `5/5 fixtures healthy`).

## Automatic Reset Between Iterations

For scenarios with `reseedPerIteration: true`, fixtures are automatically reset before each iteration via the `beforeScenario` RunHook. There is no user-facing CLI command for reset -- it is an internal lifecycle hook. The reset:

1. Force-pushes the branch to its original SHA (reverts agent commits)
   - Retries up to 3 attempts with 1-second delays on transient failures
   - Polls the ref API (up to 5 polls, 500ms apart) to confirm the reset
2. Deletes extra comments and reviews added by the agent
   - Batched GraphQL mutations (up to 10 deletions per request)
3. Verifies the fixture is back to its original state

Reset overhead is approximately 3 seconds per fixture. For a run with 5 repetitions across 3 modes, that is ~45 seconds of fixture overhead per scenario with `reseedPerIteration: true`.

## Cleanup

Remove all bench-fixture resources from the target repository:

```bash
# Remove fixtures listed in the manifest
pnpm --filter @ghx-dev/eval run eval fixture cleanup

# Discover and remove all bench-fixture labeled resources
pnpm --filter @ghx-dev/eval run eval fixture cleanup --all
```

Cleanup closes PRs/issues, deletes branches, removes labels, and deletes the manifest file.

## Writing a Manifest Manually

Use `loadFixtureManifest()` and `writeFixtureManifest()` from the eval package:

```typescript
import { loadFixtureManifest, writeFixtureManifest } from "@ghx-dev/eval"

// Read and validate
const manifest = await loadFixtureManifest("fixtures/latest.json")
console.log(manifest.seedId, manifest.repo)

// Write (creates parent directories)
await writeFixtureManifest("fixtures/latest.json", manifest)
```

Or write the JSON directly following the `FixtureManifest` schema shown above. The manifest keys must match the `requires` entries in scenario `fixture` blocks.

Source: `packages/eval/src/fixture/manifest.ts`

## Related Documentation

- [Guides Hub](./README.md) -- all available guides
- [Writing Scenarios](./writing-scenarios.md) -- how fixture bindings connect to scenario prompts
- [Fixtures Architecture](../architecture/fixtures.md) -- fixture manager internals
- [Core Concepts](../getting-started/concepts.md) -- fixtures in the context of the evaluation model
