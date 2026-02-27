# ghx-Specific Scenarios

> Back to [main design](./README.md)

---

## Overview

`@ghx-dev/eval` extends the profiler's `BaseScenario` with ghx-specific
fields: fixture bindings, checkpoint definitions using ghx capabilities, and
expected tool sequences. Scenarios are defined in JSON files and validated at
load time using Zod schemas.

---

## EvalScenario Schema

```typescript
interface EvalScenario extends BaseScenario {
  // ghx-specific identity
  readonly category: "pr" | "issue" | "workflow" | "release" | "repo"
  readonly difficulty: "basic" | "intermediate" | "advanced"

  // Fixture requirements
  readonly fixture?: {
    /** GitHub repo for fixtures (owner/name) */
    readonly repo: string
    /** Resource types that must exist */
    readonly requires: readonly string[]
    /** Map template vars to fixture manifest paths */
    readonly bindings: Readonly<Record<string, string>>
    /** Reset fixtures between iterations */
    readonly reseedPerIteration: boolean
  }

  // Verification
  readonly assertions: {
    /** Functional correctness checks using ghx capabilities */
    readonly checkpoints: readonly Checkpoint[]
    /** Optional: expected tool call pattern (glob matching) */
    readonly expectedToolSequence?: readonly string[]
    /** ghx capabilities this scenario exercises */
    readonly expectedCapabilities?: readonly string[]
  }
}

interface Checkpoint {
  /** Unique within scenario */
  readonly id: string
  /** Human-readable description */
  readonly description: string
  /** ghx capability to invoke for verification */
  readonly task: string
  /** Input to the verification task */
  readonly input: Readonly<Record<string, unknown>>
  /** How to evaluate the result */
  readonly condition: CheckpointCondition
}

type CheckpointCondition =
  | { readonly type: "non_empty" }
  | { readonly type: "empty" }
  | { readonly type: "count_gte"; readonly value: number }
  | { readonly type: "count_eq"; readonly value: number }
  | { readonly type: "field_equals"; readonly path: string; readonly value: unknown }
  | { readonly type: "field_contains"; readonly path: string; readonly value: string }
  | { readonly type: "custom"; readonly scorer: string }
```

---

## Example Scenarios

### Scenario 1: Fix PR with Mixed Review Threads

```json
{
  "id": "pr-fix-mixed-threads-wf-001",
  "name": "Fix PR with Mixed Review Threads",
  "description": "Agent must read a PR with both resolved and unresolved review threads, understand the unresolved feedback, and push a fix commit that addresses the outstanding comments.",
  "category": "pr",
  "difficulty": "intermediate",
  "prompt": "Review PR #{{pr_number}} in {{repo}}. There are unresolved review threads with requested changes. Read the unresolved comments, understand what changes are needed, make the fixes, and push a commit to the PR branch. Do not resolve the threads -- the reviewer will do that.",
  "timeoutMs": 180000,
  "allowedRetries": 1,
  "tags": ["pr", "review", "code-fix", "multi-step"],
  "fixture": {
    "repo": "{{fixture_repo}}",
    "requires": ["pr_with_mixed_threads"],
    "bindings": {
      "pr_number": "pr_with_mixed_threads.number",
      "repo": "pr_with_mixed_threads.repo"
    },
    "reseedPerIteration": true
  },
  "assertions": {
    "checkpoints": [
      {
        "id": "new-commit-pushed",
        "description": "A new commit was pushed to the PR branch after the review",
        "task": "pr.commits.list",
        "input": {
          "owner": "{{owner}}",
          "repo": "{{repo_name}}",
          "pr_number": "{{pr_number}}"
        },
        "condition": { "type": "count_gte", "value": 2 }
      },
      {
        "id": "threads-not-resolved",
        "description": "Unresolved threads remain unresolved (agent did not self-resolve)",
        "task": "pr.review_threads.list",
        "input": {
          "owner": "{{owner}}",
          "repo": "{{repo_name}}",
          "pr_number": "{{pr_number}}",
          "filter": "unresolved"
        },
        "condition": { "type": "non_empty" }
      }
    ],
    "expectedToolSequence": [
      "pr.view",
      "pr.review_threads.list",
      "bash:git*",
      "bash:git push*"
    ],
    "expectedCapabilities": [
      "pr.view",
      "pr.review_threads.list",
      "pr.commits.list"
    ]
  }
}
```

### Scenario 2: Review and Comment on PR

```json
{
  "id": "pr-review-comment-wf-001",
  "name": "Review and Comment on PR",
  "description": "Agent must review a PR diff, identify issues, and leave a constructive review comment.",
  "category": "pr",
  "difficulty": "basic",
  "prompt": "Review the changes in PR #{{pr_number}} in {{repo}}. Examine the diff carefully and leave a review comment summarizing your findings -- mention any bugs, style issues, or improvements. Submit as a comment (not approval or request-changes).",
  "timeoutMs": 120000,
  "allowedRetries": 1,
  "tags": ["pr", "review", "comment"],
  "fixture": {
    "repo": "{{fixture_repo}}",
    "requires": ["pr_with_changes"],
    "bindings": {
      "pr_number": "pr_with_changes.number",
      "repo": "pr_with_changes.repo"
    },
    "reseedPerIteration": false
  },
  "assertions": {
    "checkpoints": [
      {
        "id": "review-comment-exists",
        "description": "A review comment was posted on the PR",
        "task": "pr.reviews.list",
        "input": {
          "owner": "{{owner}}",
          "repo": "{{repo_name}}",
          "pr_number": "{{pr_number}}"
        },
        "condition": { "type": "non_empty" }
      }
    ],
    "expectedCapabilities": [
      "pr.view",
      "pr.diff",
      "pr.reviews.create"
    ]
  }
}
```

---

## Template Variable Resolution

Scenario prompts and checkpoint inputs use `{{variable}}` placeholders.
The fixture binder resolves these before execution:

```
Template: "Review PR #{{pr_number}} in {{repo}}"
Bindings: { "pr_number": "pr_with_mixed_threads.number", "repo": "pr_with_mixed_threads.repo" }
Manifest: { "pr_with_mixed_threads": { "number": 42, "repo": "aryeko/ghx-bench-fixtures" } }

Resolved: "Review PR #42 in aryeko/ghx-bench-fixtures"
```

The binder also resolves `{{owner}}` and `{{repo_name}}` by splitting the
repo path (e.g., `aryeko/ghx-bench-fixtures` -> `owner=aryeko`,
`repo_name=ghx-bench-fixtures`).

---

## Scenario Sets

Named groups for common evaluation runs:

```json
{
  "default": ["pr-fix-mixed-threads-wf-001", "pr-review-comment-wf-001"],
  "pr-only": ["pr-fix-mixed-threads-wf-001", "pr-review-comment-wf-001"],
  "full": ["pr-fix-mixed-threads-wf-001", "pr-review-comment-wf-001"]
}
```

---

## Validation

Scenarios are validated at load time:

1. **Schema validation** -- all required fields present, correct types (Zod)
2. **ID format** -- must match `^[a-z0-9]+(?:-[a-z0-9]+)*-wf-\d{3}$`
3. **Checkpoint task validity** -- each checkpoint's `task` must be a valid
   ghx capability ID (validated against `listCapabilities()`)
4. **Template completeness** -- all `{{variables}}` in the prompt have
   corresponding fixture bindings (or are provided via config)
5. **No duplicate IDs** -- across all loaded scenarios

The `eval check --scenarios` command validates all scenarios without running
them.

---

## Scenario Loader

The eval package provides a scenario loader that implements the profiler's
`ScenarioLoader` contract:

```typescript
async function loadEvalScenarios(
  ids: readonly string[],
  fixtureManifest: FixtureManifest,
): Promise<readonly EvalScenario[]> {
  // 1. Load JSON files from scenarios/ directory
  // 2. Validate against Zod schema
  // 3. Resolve template variables from fixture manifest
  // 4. Return as BaseScenario[] (EvalScenario extends BaseScenario)
}
```

The loader stores ghx-specific fields (fixture, assertions) in the
`extensions` field of `BaseScenario` so they pass through the profiler and
are accessible to the scorer, collector, and hooks via type narrowing.
