# EvalScenario Type Reference

The `EvalScenario` type defines a single evaluation scenario: the task prompt, GitHub fixture requirements, and assertion checkpoints that determine pass/fail.

## Import

```typescript
import type { EvalScenario } from "@ghx-dev/eval"
import { EvalScenarioSchema } from "@ghx-dev/eval"
```

## Interface

```typescript
interface EvalScenario {
  id: string             // Pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$/
  name: string
  description: string
  prompt: string
  timeoutMs: number
  allowedRetries: number // Default: 0
  tags: string[]         // Default: []
  category: "pr" | "issue" | "workflow" | "release" | "repo"
  difficulty: "basic" | "intermediate" | "advanced"
  fixture?: FixtureRequirements
  assertions: Assertions
}
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique scenario ID matching `<words>-NNN` pattern (e.g. `pr-fix-mixed-threads-001`) |
| `name` | `string` | Yes | Short display name for this scenario |
| `description` | `string` | Yes | Full description of the scenario's purpose and context |
| `prompt` | `string` | Yes | The task prompt sent to the agent under evaluation |
| `timeoutMs` | `number` | Yes | Maximum time in milliseconds the agent may take to complete the task |
| `allowedRetries` | `number` | No | Number of additional attempts permitted after the initial run. Default: `0` |
| `tags` | `string[]` | No | Arbitrary string tags for filtering and grouping scenarios. Default: `[]` |
| `category` | `enum` | Yes | High-level GitHub domain: `"pr"`, `"issue"`, `"workflow"`, `"release"`, or `"repo"` |
| `difficulty` | `enum` | Yes | Complexity level: `"basic"`, `"intermediate"`, or `"advanced"` |
| `fixture` | `FixtureRequirements` | No | GitHub fixture requirements; omit when the scenario needs no live fixtures |
| `assertions` | `Assertions` | Yes | Assertion checkpoints evaluated after the agent session completes |

### FixtureRequirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repo` | `string` | Yes | GitHub repo providing fixture resources in `"owner/repo"` format |
| `requires` | `string[]` | Yes | List of fixture names (keys in the manifest) this scenario depends on |
| `bindings` | `Record<string, string>` | Yes | Map of template variable names to fixture manifest paths for `{{variable}}` substitution |
| `reseedPerIteration` | `boolean` | No | Reset fixture branches to original SHAs before each iteration. Default: `false` |

### Assertions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `checkpoints` | `Checkpoint[]` | Yes | Ordered list of checkpoints evaluated after the agent session completes |
| `expectedToolSequence` | `string[]` | No | Expected ordered sequence of tool names (informational, not enforced) |
| `expectedCapabilities` | `string[]` | No | Expected ghx capability names the agent should invoke (informational, not enforced) |

### Checkpoint

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for this checkpoint within its scenario |
| `description` | `string` | Yes | Human-readable description of what is being asserted |
| `task` | `string` | Yes | ghx capability task name, e.g. `"pr.commits.list"` |
| `input` | `Record<string, unknown>` | Yes | Input passed to the capability task when evaluating this checkpoint |
| `condition` | `CheckpointCondition` | Yes | Condition that the task result must satisfy (see [Checkpoint Conditions](./checkpoint-conditions.md)) |

## Relationship to BaseScenario

`EvalScenario` extends the `BaseScenario` contract from `@ghx-dev/agent-profiler` with eval-specific fields: `category`, `difficulty`, `fixture`, and `assertions`. The base fields (`id`, `name`, `description`, `prompt`, `timeoutMs`, `allowedRetries`, `tags`) are compatible with the profiler's generic scenario interface.

## Validation

Use `EvalScenarioSchema` (Zod) to parse and validate scenario data at runtime:

```typescript
import { EvalScenarioSchema } from "@ghx-dev/eval"

const scenario = EvalScenarioSchema.parse(JSON.parse(raw))
```

Source: `packages/eval/src/scenario/schema.ts`

## Related Documentation

- [Checkpoint Conditions](./checkpoint-conditions.md) -- all 7 condition types
- [Fixture Manifest](./fixture-manifest.md) -- manifest referenced by `fixture.requires`
- [Writing Scenarios Guide](../guides/writing-scenarios.md)
- [Architecture Overview](../architecture/overview.md)
