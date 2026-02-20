# Operation Cards

Operation cards are the runtime source of truth for capabilities. Each card defines a capability's contract, schemas, and routing policy.

## Card Schema

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#9C27B0', 'primaryTextColor': '#fff', 'primaryBorderColor': '#7B1FA2', 'lineColor': '#666', 'secondaryColor': '#CE93D8', 'tertiaryColor': '#E1BEE7'}}}%%
classDiagram
    class OperationCard {
        capability_id: string
        version: string
        description: string
        input_schema: JSONSchema
        output_schema: JSONSchema
        routing: RoutingPolicy
        cli?: CLIMetadata
        graphql?: GraphQLMetadata
    }

    class RoutingPolicy {
        preferred: Route[]
        fallbacks: Route[]
    }

    class CLIMetadata {
        command: string
        args?: CliArg[]
        output_format?: string
    }

    class GraphQLMetadata {
        operation?: string
        field_mapping?: Record
        resolution?: ResolutionConfig
    }

    class ResolutionConfig {
        lookup: LookupSpec
        inject: InjectSpec[]
    }

    class Route {
        name: string
    }

    OperationCard --> RoutingPolicy
    OperationCard --> CLIMetadata
    OperationCard --> GraphQLMetadata
    GraphQLMetadata --> ResolutionConfig
    RoutingPolicy --> Route
```

## Card Contents

Each operation card includes:

| Field | Purpose | Required |
|-------|---------|----------|
| `capability_id` | Unique identifier (e.g., `pr.view`, `issue.list`) | Yes |
| `version` | Card version for tracking schema evolution | Yes |
| `description` | Human-readable purpose and scope | Yes |
| `input_schema` | JSON Schema for required/optional parameters | Yes |
| `output_schema` | JSON Schema for normalized response payload | Yes |
| `routing.preferred` | Primary route(s) to attempt first | Yes |
| `routing.fallbacks` | Secondary routes in order of preference | Yes |
| `cli` | CLI command metadata and output mapping | No |
| `graphql` | GraphQL operation, field mapping, and optional resolution block | No |

## Current Capability Surface

`ghx` currently defines **66 capabilities** across these domains:

| Domain | Count | Purpose |
|--------|-------|---------|
| **Issues** | 19 | Create, read, update, close, link, label, milestone, assign issues |
| **Pull Requests** | 21 | Read PR metadata, lists, reviews, threads, checks, mergeability, mutations |
| **Releases** | 5 | Query and draft releases, publish, update |
| **Workflows** | 11 | Query workflow runs, jobs, logs, cancel, rerun; list workflows; dispatch |
| **Repositories** | 3 | Repo metadata, label listing, issue type listing |
| **Projects (v2)** | 6 | Query and mutate projects, fields, items |
| **Check Runs** | 1 | List check run annotations |

### Issue Capabilities (19)

`issue.view`, `issue.list`, `issue.create`, `issue.update`, `issue.close`, `issue.reopen`, `issue.delete`, `issue.comments.list`, `issue.comments.create`, `issue.labels.set`, `issue.labels.add`, `issue.assignees.set`, `issue.milestone.set`, `issue.linked_prs.list`, `issue.parent.set`, `issue.parent.remove`, `issue.blocked_by.add`, `issue.blocked_by.remove`, `issue.relations.get`

### Pull Request Capabilities (21)

`pr.view`, `pr.list`, `pr.create`, `pr.update`, `pr.thread.list`, `pr.thread.reply`, `pr.thread.resolve`, `pr.thread.unresolve`, `pr.review.list`, `pr.review.submit`, `pr.review.request`, `pr.diff.files`, `pr.diff.view`, `pr.checks.list`, `pr.checks.failed`, `pr.checks.rerun_failed`, `pr.checks.rerun_all`, `pr.merge.status`, `pr.merge`, `pr.branch.update`, `pr.assignees.update`

### Release Capabilities (5)

`release.get`, `release.list`, `release.create_draft`, `release.publish_draft`, `release.update`

### Workflow Capabilities (11)

`workflow.get`, `workflow.list`, `workflow.dispatch.run`, `workflow.run.view`, `workflow.runs.list`, `workflow.run.cancel`, `workflow.run.rerun_all`, `workflow.run.rerun_failed`, `workflow.run.artifacts.list`, `workflow.job.logs.get`, `workflow.job.logs.raw`

### Repository Capabilities (3)

`repo.view`, `repo.issue_types.list`, `repo.labels.list`

### Project Capabilities (6)

`project_v2.user.get`, `project_v2.org.get`, `project_v2.fields.list`, `project_v2.items.list`, `project_v2.item.add_issue`, `project_v2.item.field.update`

### Check Run Capabilities (1)

`check_run.annotations.list`

## Card-Defined Resolution

Some GraphQL capabilities require a two-phase execution: first a **lookup query** to resolve
human-readable names (labels, assignees, milestones) into GitHub node IDs, then the actual
**mutation**. This is declared with a `graphql.resolution` block in the card.

### Resolution Block Schema

```yaml
graphql:
  operationName: IssueAssigneesUpdate
  resolution:
    lookup:
      operationName: IssueAssigneesLookup   # registered lookup query name
      vars:
        issueId: issueId                    # lookup variable → input field
    inject:
      - target: assigneeIds                 # mutation variable to populate
        source: map_array                   # inject variant
        from_input: assignees               # input field containing names
        nodes_path: node.repository.assignableUsers.nodes
        match_field: login                  # field to match against input values
        extract_field: id                   # field to extract as the resolved ID
```

### Inject Source Variants

Three `source` types control how Phase 1 lookup results (or step inputs) map into Phase 2 mutation variables:

**`scalar`** — Extract a single value from the Phase 1 result at a dot-notation path.

```yaml
inject:
  - target: pullRequestId     # mutation variable name
    source: scalar
    path: repository.pullRequest.id   # dot-path into Phase 1 response
```

**`map_array`** — Resolve a list of human-readable names to node IDs. Matching is case-insensitive.

```yaml
inject:
  - target: labelIds          # mutation variable name
    source: map_array
    from_input: labels        # input field containing the list of names
    nodes_path: repository.labels.nodes   # path to array in Phase 1 response
    match_field: name         # field on each node to match against input names
    extract_field: id         # field on each node to extract as the resolved ID
```

**`input`** — Pass a value directly from the step's `input` into the mutation variable, with no Phase 1 lookup. Use this when the caller already has the required node ID.

```yaml
inject:
  - target: labelableId       # mutation variable name
    source: input
    from_input: issueId       # the input field whose value is passed through
```

> **Tip:** Prefer `source: input` when the agent already has the required ID — it skips the Phase 1 resolution query entirely.

| `source` | Phase 1 required | Description |
|----------|-----------------|-------------|
| `scalar` | Yes | Extracts a single value at `path` from the lookup result |
| `map_array` | Yes | Maps an array of names to IDs using the lookup result |
| `input` | No | Passes a value directly from step input (no lookup needed) |

**Example — `issue.assignees.set.yaml`** (uses `map_array`):

```yaml
graphql:
  operationName: IssueAssigneesUpdate
  documentPath: src/gql/operations/issue-assignees-update.graphql
  resolution:
    lookup:
      operationName: IssueAssigneesLookup
      documentPath: src/gql/operations/issue-assignees-lookup.graphql
      vars:
        issueId: issueId
    inject:
      - target: assigneeIds
        source: map_array
        from_input: assignees
        nodes_path: node.repository.assignableUsers.nodes
        match_field: login
        extract_field: id
```

When a capability declares `graphql.resolution`, `executeTasks()` batches all resolution
lookups into a single Phase 1 GraphQL query, then batches all mutations into a single Phase 2
GraphQL mutation — resulting in at most 2 HTTP round-trips regardless of chain length.

See [Chaining Capabilities](../guides/chaining-capabilities.md) for the full two-phase
execution model.

## Card Loading & Validation

1. **Load** — cards are read from `packages/core/src/core/registry/cards/*.yaml` at module initialization
2. **Validate** — cards are validated against the card schema using AJV in `packages/core/src/core/registry/index.ts`
3. **Registry** — validated cards are indexed for fast lookup by `capability_id`
4. **Derive** — routing registry derives from loaded cards to support route planning

## Adding a Capability

To add a new capability:

1. **Create a card** — add `packages/core/src/core/registry/cards/<capability_id>.yaml` with:
   - `capability_id`, `version`, `description`
   - Complete `input_schema` and `output_schema` (JSON Schema)
   - `routing.preferred` and `routing.fallbacks`
   - Adapter-specific metadata (CLI and/or GraphQL)

2. **Implement adapters** — add support in:
   - `packages/core/src/core/execution/adapters/cli-capability-adapter.ts` (if CLI route)
   - `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts` (if GraphQL route)

3. **Write tests** — add unit and integration tests:
   - `packages/core/test/unit/` for schema and adapter logic
   - `packages/core/test/integration/` for end-to-end execution

4. **Add benchmark scenario** — create scenario in `packages/benchmark/scenarios/<capability_id>.json`:
   - Define test inputs and expected output assertions
   - Add to appropriate scenario set in `packages/benchmark/scenario-sets.json`

5. **Verify** — run:
   ```bash
   pnpm --filter @ghx-dev/benchmark run check:scenarios
   pnpm run test
   ```

## Card File Structure Example

```yaml
capability_id: repo.view
version: "1.0"
description: "View repository metadata and configuration."

input_schema:
  type: object
  properties:
    owner:
      type: string
      description: "Repository owner"
    repo:
      type: string
      description: "Repository name"
  required: [owner, repo]

output_schema:
  type: object
  properties:
    id:
      type: string
    name:
      type: string
    description:
      type: string
    url:
      type: string
  required: [id, name, url]

routing:
  preferred: [cli]
  fallbacks: [graphql]

cli:
  command: "gh"
  args:
    - arg: "repo"
    - arg: "view"
    - param: "owner/repo"
  output_format: "json"

graphql:
  operation: "getRepository"
```

## Source Files

- **Card definitions**: `packages/core/src/core/registry/cards/*.yaml`
- **Card types and loader**: `packages/core/src/core/registry/types.ts`, `packages/core/src/core/registry/index.ts`
- **Card schema validator**: `packages/core/src/core/registry/operation-card-schema.ts`
- **Schema validation**: `packages/core/src/core/registry/schema-validator.ts`

## Related Documentation

- [routing-engine.md](routing-engine.md) — how route policy is applied
- [adapters.md](adapters.md) — adapter implementation for cards
- [Result Envelope Guide](../guides/result-envelope.md) — ResultEnvelope contract details
