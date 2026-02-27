# Base Scenario Schema

> Back to [main design](./README.md)

---

## Overview

The profiler defines a minimal `BaseScenario` type that represents the
contract between the runner and consumer-provided scenarios. Consumers extend
this base with domain-specific fields (fixture bindings, checkpoint
definitions, etc.).

The profiler does not own scenario loading or validation -- consumers bring
their own loaders with domain-specific schemas. The profiler only requires
that scenarios conform to `BaseScenario`.

---

## BaseScenario

```typescript
interface BaseScenario {
  /** Unique identifier (kebab-case recommended) */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Description of what this scenario tests */
  readonly description: string

  /** The prompt to send to the agent */
  readonly prompt: string

  /** Max time for the agent turn in ms */
  readonly timeoutMs: number

  /** Number of allowed retries on transient failure */
  readonly allowedRetries: number

  /** Filtering tags */
  readonly tags: readonly string[]

  /** Consumer-specific extensions */
  readonly extensions: Readonly<Record<string, unknown>>
}
```

### Design Rationale

The base schema is intentionally minimal:

- **`id`** and **`name`** -- identity, used for grouping and reporting.
- **`prompt`** -- the text sent to the agent. Template variable resolution
  (e.g., `{{pr_number}}`) is the consumer's responsibility.
- **`timeoutMs`** and **`allowedRetries`** -- execution control that the
  runner needs to enforce.
- **`tags`** -- filtering (e.g., `--tag pr` to run only PR scenarios).
- **`extensions`** -- carries domain-specific data that the profiler
  passes through to scorers, collectors, and analyzers.

Fields the profiler does **not** define (consumer's domain):

| Field | Why Consumer-Owned |
|-------|-------------------|
| Fixture bindings | Fixture management is domain-specific |
| Checkpoint definitions | Correctness criteria vary by domain |
| Category/difficulty | Classification varies by domain |
| Expected tool sequences | Tool expectations are domain-specific |

---

## Consumer Extension Pattern

Consumers define their own scenario type that extends `BaseScenario`:

```typescript
// In @ghx-dev/eval
interface EvalScenario extends BaseScenario {
  readonly category: "pr" | "issue" | "workflow" | "release" | "repo"
  readonly difficulty: "basic" | "intermediate" | "advanced"

  readonly fixture?: {
    readonly repo: string
    readonly requires: readonly string[]
    readonly bindings: Readonly<Record<string, string>>
    readonly reseedPerIteration: boolean
  }

  readonly assertions: {
    readonly checkpoints: readonly Checkpoint[]
    readonly expectedToolSequence?: readonly string[]
    readonly expectedCapabilities?: readonly string[]
  }
}
```

The consumer's loader validates against their extended schema, then passes the
scenarios to `runProfileSuite()` which treats them as `BaseScenario` (the
extra fields flow through `extensions` or are accessed by the consumer's own
scorer/collector implementations via type narrowing).

---

## Scenario Sets

The profiler supports grouping scenarios into named sets for convenience.
The set format is a simple map:

```typescript
type ScenarioSets = Readonly<Record<string, readonly string[]>>
```

```json
{
  "default": ["scenario-a", "scenario-b"],
  "quick": ["scenario-a"],
  "full": ["scenario-a", "scenario-b", "scenario-c"]
}
```

The runner resolves a set name to scenario IDs, then loads the corresponding
scenario files. Consumers can override with `--scenario <id>` CLI flags.

---

## Scenario Loading Contract

The profiler does not load scenarios directly. Instead, consumers provide a
scenario loader function:

```typescript
type ScenarioLoader = (
  ids: readonly string[],
) => Promise<readonly BaseScenario[]>
```

This allows consumers to:
1. Load from their own file format (JSON, YAML, etc.)
2. Validate against their extended schema
3. Resolve template variables (e.g., fixture bindings)
4. Apply any preprocessing

The runner calls the loader once at startup, then iterates over the returned
scenarios.
