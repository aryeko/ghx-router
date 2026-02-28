# Checkpoint Conditions

Checkpoint conditions define the pass/fail criteria evaluated against live GitHub state after an agent session completes. Each condition is a variant in a discriminated union keyed by `type`.

## Import

```typescript
import type { CheckpointCondition } from "@ghx-dev/eval"
```

## Condition Types

### `non_empty`

Passes when the task result is non-empty (non-empty array, or non-null/non-undefined value).

```typescript
{ type: "non_empty" }
```

### `empty`

Passes when the task result is empty (empty array, null, or undefined).

```typescript
{ type: "empty" }
```

### `count_gte`

Passes when the result array length is greater than or equal to `value`.

```typescript
{ type: "count_gte", value: number }
```

Example: `{ type: "count_gte", value: 3 }` -- at least 3 items in the result.

### `count_eq`

Passes when the result array length equals `value` exactly.

```typescript
{ type: "count_eq", value: number }
```

Example: `{ type: "count_eq", value: 1 }` -- exactly 1 item in the result.

### `field_equals`

Passes when `result[path]` strictly equals `value`. Supports dot-notation for nested fields.

```typescript
{ type: "field_equals", path: string, value: string | number | boolean | null }
```

Example: `{ type: "field_equals", path: "state", value: "closed" }` -- the `state` field equals `"closed"`.

### `field_contains`

Passes when `result[path]` contains the `value` substring. The field must be a string.

```typescript
{ type: "field_contains", path: string, value: string }
```

Example: `{ type: "field_contains", path: "body", value: "fix applied" }` -- the `body` field contains `"fix applied"`.

### `custom`

Delegates to a named custom scorer function. Reserved for v2 -- not yet implemented.

```typescript
{ type: "custom", scorer: string }
```

## How Conditions Are Evaluated

The `CheckpointScorer` processes each checkpoint in `scenario.assertions.checkpoints`:

1. Executes the ghx capability task specified in `checkpoint.task` with `checkpoint.input`
2. Tests the task result against `checkpoint.condition` using the `evaluateCondition` function
3. Returns a `ScorerCheckResult` with `passed: true/false` and the actual vs. expected values
4. All checkpoints must pass for the overall `ScorerResult.success` to be `true`

## Dot-Notation Field Access

The `field_equals` and `field_contains` conditions use dot-notation to access nested fields:

```typescript
// Given result: { data: { pr: { title: "Fix bug" } } }
{ type: "field_equals", path: "data.pr.title", value: "Fix bug" }
```

The path is split on `.` and each segment traverses one level into the object. If any intermediate value is null or not an object, the field resolves to `undefined`.

Source: `packages/eval/src/scenario/schema.ts`, `packages/eval/src/scorer/checkpoint-scorer.ts`

## Related Documentation

- [EvalScenario Type Reference](./eval-scenario.md) -- scenario structure containing checkpoints
- [Writing Scenarios Guide](../guides/writing-scenarios.md)
- [Architecture Overview](../architecture/overview.md)
