# Roadmap

## Current State

ghx ships **70 capabilities** across 6 domains:

| Domain | Count |
|--------|-------|
| Issues | 23 |
| Pull Requests | 21 |
| Workflows | 11 |
| Releases | 5 |
| Repositories | 3 |
| Projects v2 | 7 |

See the [full capability list](docs/capabilities/README.md) for details on every operation.

## Delivered

### v0.1.0

- Core routing engine with CLI and GraphQL adapters
- Initial PR and issue read capabilities (view, list, comments, reviews, diff, checks)
- Workflow run and job inspection (list, logs, annotations)
- Normalized result envelope contract (`ok`, `data`, `error`, `meta`)
- Structured error taxonomy with deterministic error codes
- `ghx setup` onboarding and `ghx capabilities list`/`explain` discovery commands
- Benchmark harness comparing agent_direct vs ghx execution

### v0.2.0

- Full PR execution: review submission, merge, rerun checks, reviewer/assignee management, branch update
- Complete issue lifecycle: create, update, close, reopen, delete, labels, assignees, milestones, comments, linked PRs, sub-issue relations
- Release operations: list, get, create draft, update, publish draft
- Extended workflow controls: dispatch, rerun, cancel, artifacts
- Projects v2: org/user project retrieval, field listing, item management
- Repository metadata: labels list, issue types list
- `ghx chain` command for batching multiple operations in a single tool call
- GraphQL batching for multi-query execution
- Compact output mode
- Operation cards defining input/output schemas and routing preferences

## What's Next

- **MCP mode support** -- the benchmark harness already exercises an MCP execution mode; the core package needs adapter implementation to support it end-to-end
- **REST adapter** -- a stub exists in the codebase; implementing it adds a third routing option and improves fallback coverage
- **Additional capability domains** -- discussions, gists, and code search are natural expansions
- **Performance improvements** -- response streaming and parallel execution for batch operations

## Contributing to the Roadmap

Have ideas or want to influence priorities? Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues).
