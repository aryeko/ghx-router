# Writing Scenarios

Step-by-step guide to creating evaluation scenarios with fixtures, checkpoints, and template variables.

## Step 1: Choose Category and Difficulty

Every scenario declares a GitHub domain category and a difficulty level:

| Field | Values | Purpose |
|-------|--------|---------|
| `category` | `pr`, `issue`, `workflow`, `release`, `repo` | GitHub domain exercised |
| `difficulty` | `basic`, `intermediate`, `advanced` | Complexity for reporting and selection |

Choose the category that best matches the primary GitHub operation. If a scenario spans multiple domains, pick the one containing the verification checkpoint.

## Step 2: Pick a Scenario ID

IDs must match the regex `^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$` -- lowercase words separated by hyphens, ending with a three-digit number.

Examples of valid IDs:
- `pr-review-comment-001`
- `issue-label-add-002`
- `workflow-dispatch-003`
- `release-create-draft-001`

The numeric suffix provides ordering within a category. Start at `001` for the first scenario in each domain.

## Step 3: Write the Prompt

The `prompt` field contains the task sent to the agent. Use `{{variable}}` placeholders for fixture-dependent values:

```text
"Review the changes in PR #{{pr_number}} in {{repo}}. Examine the diff carefully and leave a review comment summarizing your findings."
```

The prompt is identical across all three modes (ghx, mcp, baseline) -- this isolates the routing mechanism as the independent variable.

## Step 4: Define Fixture Requirements

The `fixture` block declares what GitHub resources the scenario needs:

| Field | Type | Purpose |
|-------|------|---------|
| `repo` | `string` | Fixture repository, typically `"{{fixture_repo}}"` |
| `requires` | `string[]` | Resource types from the manifest (e.g. `["pr_with_changes"]`) |
| `bindings` | `Record<string, string>` | Maps template variables to manifest paths |
| `reseedPerIteration` | `boolean` | Reset fixtures between iterations (use for mutating scenarios) |

Set `reseedPerIteration: true` when the agent modifies the fixture (pushes commits, merges PRs). Set it to `false` for read-only scenarios (reviewing, listing).

## Step 5: Write Checkpoints

Each checkpoint verifies a specific post-condition using a ghx capability:

```json
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
```

Fields:
- `id` -- unique within the scenario
- `description` -- human-readable assertion statement
- `task` -- ghx capability name used to query live GitHub state
- `input` -- parameters for the capability call (supports `{{variable}}` placeholders)
- `condition` -- rule applied to the task result

### Condition Type Reference

| Type | Parameters | Passes when |
|------|-----------|-------------|
| `non_empty` | -- | Result array has at least one element |
| `empty` | -- | Result array is empty |
| `count_gte` | `value: number` | Result count >= value |
| `count_eq` | `value: number` | Result count equals value |
| `field_equals` | `path`, `value` | `result[path]` strictly equals value |
| `field_contains` | `path`, `value` | `result[path]` contains substring |
| `custom` | `scorer: string` | Delegates to a named custom scorer (v2) |

For full condition semantics, see [Checkpoint Conditions API](../api/checkpoint-conditions.md).

## Step 6: Add to a Scenario Set

Register the scenario ID in `scenarios/scenario-sets.json`:

```json
{
  "default": ["pr-fix-mixed-threads-wf-001", "pr-review-comment-001"],
  "pr-only": ["pr-fix-mixed-threads-wf-001", "pr-review-comment-001"]
}
```

The `set` field in `eval.config.yaml` selects which scenario set to run.

## Step 7: Validate

Run `eval check` to validate the scenario without executing it:

```bash
pnpm --filter @ghx-dev/eval run eval check --scenarios
```

Validation checks:
1. Schema validation -- all required fields present with correct types (Zod)
2. ID format -- matches `^[a-z0-9]+(?:-[a-z0-9]+)*-\d{3}$`
3. Checkpoint task validity -- each `task` is a valid ghx capability
4. Template completeness -- all `{{variables}}` have corresponding bindings
5. No duplicate IDs -- across all loaded scenarios

## Complete Example

The following is the full `pr-review-comment-001.json` scenario file:

```json
{
  "id": "pr-review-comment-001",
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
    "expectedCapabilities": ["pr.view", "pr.diff", "pr.reviews.create"]
  }
}
```

Source: `packages/eval/scenarios/pr-review-comment-001.json`, `packages/eval/src/scenario/schema.ts`

## Related Documentation

- [Guides Hub](./README.md) -- all available guides
- [Managing Fixtures](./managing-fixtures.md) -- fixture seeding, reset, and cleanup
- [Core Concepts](../getting-started/concepts.md) -- modes, checkpoints, execution matrix
- [Scenarios Architecture](../architecture/scenarios.md) -- scenario loading and validation internals
- [Checkpoint Conditions API](../api/checkpoint-conditions.md) -- full condition type reference
