# Scenario Authoring

A guide for writing benchmark scenarios for new capabilities and adding them to scenario sets.

## Scenario Structure

Each scenario is a JSON file in `packages/benchmark/scenarios/` that defines:

- **Metadata** — scenario ID, name, capability task
- **Input** — parameters for the task (with placeholders for fixtures)
- **Execution config** — timeout, retries, prompt template
- **Fixture bindings** — optional fixture data mappings
- **Assertions** — validation rules for output

### Minimal Example

```json
{
  "id": "issue-view-001",
  "name": "View issue details",
  "task": "issue.view",
  "input": {
    "owner": "OWNER_PLACEHOLDER",
    "name": "REPO_PLACEHOLDER",
    "issueNumber": 1
  },
  "prompt_template": "Execute task {{task}} using input {{input_json}}. Return only valid JSON matching this envelope: {\"ok\": boolean, \"data\": any, \"error\": object|null, \"meta\": object}.",
  "timeout_ms": 60000,
  "allowed_retries": 0,
  "assertions": {
    "require_tool_calls": true,
    "min_tool_calls": 1,
    "max_tool_calls": 3,
    "required_fields": ["ok", "data", "error", "meta"],
    "required_data_fields": ["number", "title", "state"],
    "expected_outcome": "success"
  },
  "tags": ["issue", "view", "thin-slice"]
}
```

## Field Definitions

### Metadata

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique scenario identifier (kebab-case), e.g., `pr-view-001` |
| `name` | string | yes | Human-readable description |
| `task` | string | yes | Capability task ID from registry, e.g., `pr.view` |
| `tags` | string[] | no | Domain tags: `pr`, `issue`, `workflow`, `mutation`, `thin-slice`, etc. |

### Input

```json
"input": {
  "owner": "OWNER_PLACEHOLDER",
  "name": "REPO_PLACEHOLDER",
  "optionalField": "value"
}
```

- **Placeholders** are replaced at runtime by fixture bindings or explicitly
- Use `OWNER_PLACEHOLDER` and `REPO_PLACEHOLDER` for repository info
- Include all required parameters for the capability
- Add optional parameters only if testing specific variants

### Execution Config

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `prompt_template` | string | (shown below) | Template string with `{{task}}` and `{{input_json}}` variables |
| `timeout_ms` | number | 60000 | Timeout for assistant response (ms) |
| `allowed_retries` | number | 0 | Number of retries on failure |

**Default prompt template:**

```
Execute task {{task}} using input {{input_json}}. Return only valid JSON matching this envelope: {"ok": boolean, "data": any, "error": object|null, "meta": object}.
```

Customize if you need to provide additional context or constraints.

### Fixture Bindings

```json
"fixture": {
  "repo": "aryeko/ghx-bench-fixtures",
  "bindings": {
    "input.owner": "repo.owner",
    "input.name": "repo.name",
    "input.prNumber": "resources.pr.number",
    "input.issueNumber": "resources.issue.number"
  }
}
```

**Binding paths:**
- `repo.owner` — repository owner from fixture
- `repo.name` — repository name
- `resources.pr.number` — created PR number (from seeded mutations)
- `resources.issue.number` — created issue number
- `resources.label.name` — created label
- etc.

**When to use fixtures:**
- Mutation scenarios (create, update, delete) — need deterministic state
- Scenarios requiring specific issue/PR numbers
- Scenarios testing against known fixture data

**When to skip fixtures:**
- Simple read-only scenarios (view, list) on public repos
- Scenarios that work with any repository state

### Assertions

Assertions validate that the returned envelope matches expectations. For full details, see [Scenario Assertions](./scenario-assertions.md).

Common assertion patterns:

#### Read Operations (View, List)

```json
"assertions": {
  "require_tool_calls": true,
  "min_tool_calls": 1,
  "max_tool_calls": 3,
  "required_fields": ["ok", "data", "error", "meta"],
  "required_data_fields": ["id", "title"],
  "required_meta_fields": ["route_used"],
  "expected_route_used": "cli",
  "expected_outcome": "success"
}
```

#### Mutation Operations (Create, Update, Delete)

```json
"assertions": {
  "require_tool_calls": true,
  "min_tool_calls": 1,
  "required_fields": ["ok", "data", "error", "meta"],
  "data_type": "object",
  "expected_outcome": "success"
}
```

#### Error Path Tests

```json
"assertions": {
  "require_tool_calls": false,
  "required_fields": ["ok", "data", "error", "meta"],
  "expected_error_code": "VALIDATION",
  "expected_outcome": "failure"
}
```

## Adding a Scenario for a New Capability

### Step 1: Create Scenario JSON

Create `packages/benchmark/scenarios/<capability-id>-001.json`:

```bash
# Example: adding a scenario for issue.comment.create
cat > packages/benchmark/scenarios/issue-comment-create-001.json << 'EOF'
{
  "id": "issue-comment-create-001",
  "name": "Create comment on issue",
  "task": "issue.comment.create",
  "input": {
    "owner": "OWNER_PLACEHOLDER",
    "name": "REPO_PLACEHOLDER",
    "issueNumber": 1,
    "body": "Test comment from benchmark"
  },
  "prompt_template": "Execute task {{task}} using input {{input_json}}. Return only valid JSON matching this envelope: {\"ok\": boolean, \"data\": any, \"error\": object|null, \"meta\": object}.",
  "timeout_ms": 60000,
  "allowed_retries": 0,
  "fixture": {
    "repo": "aryeko/ghx-bench-fixtures",
    "bindings": {
      "input.owner": "repo.owner",
      "input.name": "repo.name",
      "input.issueNumber": "resources.issue.number"
    }
  },
  "assertions": {
    "require_tool_calls": true,
    "min_tool_calls": 1,
    "required_fields": ["ok", "data", "error", "meta"],
    "required_data_fields": ["id", "body"],
    "expected_outcome": "success"
  },
  "tags": ["issue", "comment", "mutation"]
}
EOF
```

### Step 2: Validate Scenario

Use the built-in validator:

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
```

This verifies:
- JSON syntax is valid
- All required fields are present
- Schema matches expected structure
- Task ID exists in registry
- No duplicate IDs

### Step 3: Add to Scenario Set

Edit `packages/benchmark/scenario-sets.json` and add the scenario ID to relevant sets:

```json
{
  "default": [
    "repo-view-001",
    "issue-comment-create-001",
    ...
  ],
  "issues": [
    "issue-comment-create-001",
    ...
  ]
}
```

### Step 4: Run Locally

Test the scenario against one mode:

```bash
# If fixture bindings, seed first
pnpm --filter @ghx-dev/benchmark run fixtures -- \
  seed --repo aryeko/ghx-bench-fixtures \
  --out fixtures/latest.json --seed-id local

# Run scenario
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 \
  --scenario issue-comment-create-001 \
  --fixture-manifest fixtures/latest.json

# View results
jq 'select(.scenario_id == "issue-comment-create-001")' \
  packages/benchmark/results/*.jsonl
```

**Expected output:**
- `success: true`
- `output_valid: true`
- `tool_calls >= 1`

If assertions fail, update them based on actual output and re-run.

## Testing Scenarios Locally

### Quick Test Against One Mode

```bash
# Single run
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 \
  --scenario issue-comment-create-001

# Multiple runs
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 5 \
  --scenario issue-comment-create-001
```

### Full Validation (Both Modes)

```bash
# Create temporary scenario set
jq '. + {"temp-test": ["issue-comment-create-001"]}' \
  packages/benchmark/scenario-sets.json > /tmp/scenario-sets.json

# Test both modes
pnpm --filter @ghx-dev/benchmark run benchmark -- agent_direct 2 \
  --scenario-set temp-test

pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 2 \
  --scenario-set temp-test

# View summary
pnpm --filter @ghx-dev/benchmark run report

# Check output
jq 'select(.scenario_id == "issue-comment-create-001")' \
  packages/benchmark/results/*.jsonl | jq -s 'group_by(.mode) | map({mode: .[0].mode, count: length})'
```

### Debug Assertion Failures

If assertions fail, inspect the raw envelope:

```bash
# Extract first JSON object from result
jq 'select(.scenario_id == "issue-comment-create-001") | .raw_output' \
  packages/benchmark/results/*.jsonl | head -1 | jq .

# Check what fields were found
jq 'select(.scenario_id == "issue-comment-create-001") | {ok, data_type: (.data | type), error, meta}' \
  packages/benchmark/results/*.jsonl | head -1
```

Update `assertions.required_data_fields` based on actual output.

## Scenario Best Practices

### Naming

- IDs: `<domain>-<action>-<variant>` (e.g., `pr-merge-execute-001`, `issue-create-simple-002`)
- Name: descriptive, ~40 chars max (e.g., "Create issue with title and body")

### Input Design

- Use placeholders for repo/resource references
- Hard-code test data (titles, bodies) in the scenario
- Avoid randomization — scenarios should be deterministic

### Assertions

- Always include `required_fields: ["ok", "data", "error", "meta"]`
- For reads, validate key data fields (e.g., `required_data_fields: ["id", "title", "state"]`)
- For mutations, validate that ID is returned
- Include `require_tool_calls: true` except for error-path tests

### Fixtures

- Mutation scenarios **must** use fixtures to avoid polluting the main repo
- Use `aryeko/ghx-bench-fixtures` as the fixture repo
- Seed before running mutations, cleanup after

### Tags

Use consistent tags for organization:

- **Domain:** `pr`, `issue`, `workflow`, `project-v2`, `release`, etc.
- **Operation type:** `view`, `list`, `create`, `update`, `delete`, `mutation`
- **Scenario type:** `thin-slice` (minimal capability), `roadmap` (A-D roadmap), etc.

## Validation Schema Reference

Full schema validation happens at `packages/benchmark/src/scenario/schema.ts`. Key rules:

- `id` — required, must be unique, kebab-case
- `task` — required, must exist in capability registry
- `input` — required, must include all capability parameters
- `assertions` — required, must include `required_fields` at minimum
- `timeout_ms` — must be positive, reasonable (60000-120000ms typical)
- `allowed_retries` — typically 0 for determinism
- Fixture bindings must reference valid fixture paths

## Common Pitfalls

### Assertions Too Strict

If assertions fail on valid output, relax them:

```json
// Too strict
"required_data_fields": ["id", "title", "state", "assignees", "labels"]

// Better
"required_data_fields": ["id", "title", "state"]
```

### Fixtures Not Seeded

Mutation scenarios fail silently if fixtures aren't seeded:

```bash
# Always seed before running mutations
pnpm --filter @ghx-dev/benchmark run fixtures -- seed ...
pnpm --filter @ghx-dev/benchmark run benchmark -- ...
pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup ...
```

### Conflicting Input Types

Make sure input types match the capability schema:

```json
// BAD: issueNumber as string
"issueNumber": "1"

// GOOD: issueNumber as number
"issueNumber": 1
```

### Timeout Too Short

If scenarios consistently timeout, increase timeout:

```json
"timeout_ms": 120000  // 2 minutes instead of 1
```

## See Also

- [Scenario Assertions](./scenario-assertions.md) — assertion schema details
- [Running Benchmarks](./running-benchmarks.md) — how to run scenarios
- [Methodology](./methodology.md) — benchmark design and controls
