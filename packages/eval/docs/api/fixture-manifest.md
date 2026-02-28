# Fixture Manifest

The `FixtureManifest` type describes the set of GitHub fixture resources created for an eval seed run. Scenarios reference fixtures by name through their `fixture.requires` entries.

## Import

```typescript
import type { FixtureManifest } from "@ghx-dev/eval"
import { loadFixtureManifest, writeFixtureManifest } from "@ghx-dev/eval"
```

## FixtureManifest Interface

```typescript
interface FixtureManifest {
  seedId: string
  createdAt: string
  repo: string
  fixtures: Record<string, FixtureResource>
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `seedId` | `string` | Yes | Identifier for the seed run that created this manifest |
| `createdAt` | `string` | Yes | ISO-8601 timestamp of when the manifest was created |
| `repo` | `string` | Yes | GitHub repo containing all fixtures in `"owner/repo"` format |
| `fixtures` | `Record<string, FixtureResource>` | Yes | Map of fixture name to resource details. Keys match scenario `fixture.requires` entries |

## FixtureResource Interface

```typescript
interface FixtureResource {
  type: string
  number: number
  repo: string
  branch?: string
  labels?: string[]
  metadata?: Record<string, unknown>  // Default: {}
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Resource type identifier, e.g. `"pr"` or `"issue"` |
| `number` | `number` | Yes | GitHub issue or PR number |
| `repo` | `string` | Yes | Full `"owner/repo"` string for the fixture repository |
| `branch` | `string` | No | Associated branch name, if the fixture involves a PR branch |
| `labels` | `string[]` | No | Labels applied to the GitHub resource for identification and cleanup |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata; `originalSha` is used by `FixtureManager` to reset branches. Default: `{}` |

## Functions

### `loadFixtureManifest(path)`

Reads and validates a fixture manifest from a JSON file.

```typescript
async function loadFixtureManifest(path: string): Promise<FixtureManifest>
```

- **path** -- Absolute or relative path to the manifest JSON file
- **Returns** -- Validated `FixtureManifest`
- **Throws** -- When the file does not exist or fails schema validation

```typescript
const manifest = await loadFixtureManifest("fixtures/latest.json")
console.log(manifest.seedId, manifest.repo)
```

### `writeFixtureManifest(path, manifest)`

Serializes a fixture manifest to a JSON file, creating parent directories as needed.

```typescript
async function writeFixtureManifest(path: string, manifest: FixtureManifest): Promise<void>
```

- **path** -- Path to write the manifest JSON
- **manifest** -- Manifest to serialize

```typescript
await writeFixtureManifest("fixtures/latest.json", manifest)
```

Source: `packages/eval/src/fixture/manifest.ts`

## Related Documentation

- [EvalScenario Type Reference](./eval-scenario.md) -- scenarios reference fixtures via `fixture.requires`
- [Writing Scenarios Guide](../guides/writing-scenarios.md)
- [Architecture Overview](../architecture/overview.md)
