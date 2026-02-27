# Fixture Management

> Back to [main design](./README.md)

---

## Overview

Fixtures are pre-seeded GitHub resources (PRs, issues, branches, labels, etc.)
that scenarios reference. The fixture manager handles seeding, status checking,
resetting between iterations, and cleanup. Fixture lifecycle is implemented as
`RunHooks` callbacks.

---

## Fixture Architecture

```
eval.config.yaml
    |
    +-- fixtures.repo: "aryeko/ghx-bench-fixtures"
    +-- fixtures.manifest: "fixtures/latest.json"
    |
    v
FixtureManager
    |
    +-- seed()      Create all fixtures defined in scenario requirements
    |
    +-- status()    Check which fixtures exist, which are missing
    |
    +-- reset()     Reset a specific fixture to its original state
    |                (e.g., force-push PR branch, delete extra commits)
    |
    +-- cleanup()   Remove all fixtures from the target repo
    |
    v
Manifest File (fixtures/latest.json)
    |
    +-- Maps fixture types to created resource IDs
    +-- Used by scenario loader for template variable resolution
```

---

## Fixture Manifest

The manifest tracks all seeded fixtures and their resource identifiers:

```typescript
interface FixtureManifest {
  readonly seedId: string
  readonly createdAt: string
  readonly repo: string
  readonly fixtures: Readonly<Record<string, FixtureResource>>
}

interface FixtureResource {
  readonly type: string                // e.g., "pr_with_mixed_threads"
  readonly number: number              // PR/issue number
  readonly repo: string                // Full repo path
  readonly branch?: string             // Branch name (for PRs)
  readonly labels?: readonly string[]  // Applied labels
  readonly metadata: Readonly<Record<string, unknown>>
}
```

**Example manifest:**

```json
{
  "seedId": "default",
  "createdAt": "2026-02-27T12:00:00Z",
  "repo": "aryeko/ghx-bench-fixtures",
  "fixtures": {
    "pr_with_mixed_threads": {
      "type": "pr_with_mixed_threads",
      "number": 42,
      "repo": "aryeko/ghx-bench-fixtures",
      "branch": "bench-fixture/pr-mixed-threads-42",
      "labels": ["bench-fixture"],
      "metadata": {
        "resolvedThreads": 2,
        "unresolvedThreads": 3,
        "commits": 1
      }
    },
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

---

## Fixture Lifecycle

### Seeding

Creates all fixtures required by the selected scenarios:

```
eval fixture seed
    |
    +-- Load scenario files
    +-- Collect all unique fixture.requires across scenarios
    +-- For each required fixture type:
    |     +-- Create branch
    |     +-- Create commits with specific file changes
    |     +-- Create PR / issue / label as needed
    |     +-- Add review comments / threads as needed
    |     +-- Label with "bench-fixture" for discovery
    |     +-- Record in manifest
    +-- Write manifest to fixtures/latest.json
```

### Status Check

Verifies that all required fixtures exist and are in the expected state:

```
eval fixture status
    |
    +-- Load manifest
    +-- For each fixture:
    |     +-- Verify resource exists (gh api)
    |     +-- Verify state matches expectations
    |     +-- Report: OK / MISSING / STALE
    +-- Summary: X/Y fixtures healthy
```

### Reset (Between Iterations)

For scenarios with `reseedPerIteration: true`, the fixture must be reset
to its original state before each iteration:

```
beforeScenario hook (if reseedPerIteration)
    |
    +-- Force-push original branch state (revert agent's commits)
    +-- Delete any extra comments/reviews the agent added
    +-- Verify fixture is back to original state
```

### Cleanup

Removes all bench-fixture resources from the target repo:

```
eval fixture cleanup [--all]
    |
    +-- If --all: discover all "bench-fixture" labeled resources
    +-- Else: load manifest and delete listed resources
    +-- For each resource:
    |     +-- Close PR / issue
    |     +-- Delete branch
    |     +-- Remove labels
    +-- Delete manifest file
```

---

## Integration with RunHooks

Fixture lifecycle is wired into the profiler via `RunHooks`:

```typescript
function createEvalHooks(options: {
  fixtureManager: FixtureManager
  sessionExport: boolean
}): RunHooks {
  return {
    beforeRun: async (ctx) => {
      // Verify fixtures exist, seed if --seed-if-missing
      const status = await options.fixtureManager.status()
      if (status.missing.length > 0) {
        throw new Error(`Missing fixtures: ${status.missing.join(", ")}`)
      }
    },

    beforeScenario: async (ctx) => {
      // Reset fixture if scenario requires it
      const scenario = ctx.scenario as EvalScenario
      if (scenario.fixture?.reseedPerIteration) {
        await options.fixtureManager.reset(scenario.fixture.requires)
      }
    },

    afterScenario: async (ctx) => {
      // Export session trace if configured
      if (options.sessionExport && ctx.trace) {
        await writeSessionTrace(ctx.trace, ctx.scenario.id, ctx.mode, ctx.iteration)
      }
    },
  }
}
```

---

## Fixture CLI

```
eval fixture <command> [options]

Commands:
  seed       Seed fixtures in the target repo
  status     Check fixture status
  cleanup    Remove all fixtures

Options:
  --repo <owner/name>      Target repo (default: from config)
  --manifest <path>        Manifest file path (default: fixtures/latest.json)
  --seed-id <id>           Seed identifier for labeling (default: "default")
  --all                    (cleanup) Discover and remove all bench-fixture resources
```
