# ghx

> A stable capability interface for AI agents that interact with GitHub.

[![CI](https://github.com/aryeko/ghx/actions/workflows/ci-pr.yml/badge.svg)](https://github.com/aryeko/ghx/actions/workflows/ci-pr.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

AI agents that work with GitHub waste tokens re-discovering the API surface on every run. They re-fetch schemas, re-learn endpoints, and re-parse documentation—leading to higher latency, higher cost, and brittle behavior.

## The Solution

ghx provides a **card-driven capability router** that gives agents a stable, typed interface to GitHub operations. Agents call capabilities by ID; ghx handles route selection (GraphQL, CLI, REST), retries, fallbacks, and normalized output—so agents spend tokens on reasoning, not on API discovery.

## Quick Start

```bash
# From the repo (CLI is in @ghx/core)
pnpm install
pnpm run build
ghx setup --platform claude-code --scope project --yes
ghx setup --platform claude-code --scope project --verify
ghx capabilities list
ghx capabilities explain pr.merge.execute
pnpm exec ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Setup skill (project scope) and discover capabilities:

```bash
pnpm exec ghx setup --scope project --yes
pnpm exec ghx capabilities list
pnpm exec ghx capabilities explain repo.view
```

Normalized output:

```json
{
  "ok": true,
  "data": { "id": "...", "name": "ghx", "nameWithOwner": "aryeko/ghx", ... },
  "error": null,
  "meta": {
    "capability_id": "repo.view",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

## How It Works

- Capabilities are defined by runtime-loaded operation cards in `packages/core/src/core/registry/cards/*.yaml`.
- Route plan is deterministic: `preferred` then ordered `fallbacks`.
- CLI-suitable capabilities (`repo.view`, `issue.view`, `issue.list`, `pr.view`, `pr.list`) prefer `cli` with `graphql` fallback.
- `issue.comments.list` prefers `graphql` with `cli` fallback.
- REST is not part of v1 route preference ordering.
- Preflight checks gate route eligibility before execution.

## Runtime Guarantees

- Stable envelope contract (`ok`, `data`, `error`, `meta`).
- Structured error taxonomy (AUTH, VALIDATION, NETWORK, RATE_LIMIT, SERVER, etc).
- Route-level retry/fallback orchestration with optional attempt trace metadata.
- Telemetry events for route planning/attempts; sensitive context is redacted.

## Benchmarking

- Harness: `packages/benchmark/`
- Scenarios: `packages/benchmark/scenarios/`
- Runner and extraction: `packages/benchmark/src/`
- Summary artifacts: `packages/benchmark/reports/`

## Docs

- Architecture overview: `docs/architecture/overview.md`
- CLI subcommands design: `docs/architecture/cli-subcommands-design.md`
- System design: `docs/architecture/system-design.md`
- Contracts: `docs/architecture/contracts.md`
- Routing policy: `docs/architecture/routing-policy.md`
- Errors and retries: `docs/architecture/errors-and-retries.md`
- Repository structure: `docs/architecture/repository-structure.md`
- Agent interface tools: `docs/architecture/agent-interface-tools.md`
- Operation card registry: `docs/architecture/operation-card-registry.md`
- Telemetry: `docs/architecture/telemetry.md`
- Benchmark methodology: `docs/benchmark/methodology.md`
- Benchmark metrics: `docs/benchmark/metrics.md`
- Benchmark harness design: `docs/benchmark/harness-design.md`
- Benchmark reporting: `docs/benchmark/reporting.md`
- Efficiency criteria: `docs/benchmark/efficiency-criteria.md`
- Scenario assertions: `docs/benchmark/scenario-assertions.md`
- CI workflows: `docs/engineering/ci-workflows.md`
- Nx commands: `docs/engineering/nx-commands.md`
- Publishing guide: `docs/guides/publishing.md`
- Roadmap golden flows: `docs/guides/roadmap-golden-flows.md`
- Codecov coverage policy: `docs/quality/codecov-coverage-policy.md`

## Verification

```bash
pnpm run build
pnpm run lint
pnpm run ci
pnpm run ghx:gql:check
pnpm run benchmark:check
```

## Adoption Priorities

ghx prioritizes the following sequence:

1. **Setup first:** ship `ghx setup` for fast, verifiable onboarding (`user` and `project` scope).
   - include `ghx capabilities list` and `ghx capabilities explain <capability_id>` as discovery entrypoints
2. **Capability batches A-D:** complete PR execution, issue lifecycle, release flow, and workflow/Projects v2 controls.
3. **Adoption next:** package/public API hardening, compatibility matrix, public ROI benchmarks, and ecosystem templates.

See `ROADMAP.md` for the full capability inventory, batch exit criteria, and success metrics.

## Capabilities

Core capabilities currently include:

- Repository + issues: `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`
- Pull request base: `pr.view`, `pr.list`
- Pull request review reads: `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`
- Pull request checks + mergeability: `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`
- Pull request thread mutations: `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`
- CI diagnostics and logs: `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`
- Batch A PR execution: `pr.review.submit_approve`, `pr.review.submit_request_changes`, `pr.review.submit_comment`, `pr.merge.execute`, `pr.checks.rerun_failed`, `pr.checks.rerun_all`, `pr.reviewers.request`, `pr.assignees.update`, `pr.branch.update`
- Batch B issue lifecycle: `issue.create`, `issue.update`, `issue.close`, `issue.reopen`, `issue.delete`, `issue.labels.update`, `issue.assignees.update`, `issue.milestone.set`, `issue.comments.create`, `issue.linked_prs.list`, `issue.relations.get`, `issue.parent.set`, `issue.parent.remove`, `issue.blocked_by.add`, `issue.blocked_by.remove`
- Batch C release/delivery: `release.list`, `release.get`, `release.create_draft`, `release.update`, `release.publish_draft`, `workflow_dispatch.run`, `workflow_run.rerun_failed`
- Batch D workflow/projects/repo metadata: `workflow.list`, `workflow.get`, `workflow_run.get`, `workflow_run.rerun_all`, `workflow_run.cancel`, `workflow_run.artifacts.list`, `project_v2.org.get`, `project_v2.user.get`, `project_v2.fields.list`, `project_v2.items.list`, `project_v2.item.add_issue`, `project_v2.item.field.update`, `repo.labels.list`, `repo.issue_types.list`

## Golden Flows

- Batch A (PR execution): review -> rerun checks -> merge -> branch update
- Batch B (issue lifecycle): create/update -> assign/label -> set relations -> close/reopen/delete
- Batch C (release delivery): list/get -> create_draft -> update -> publish_draft -> rerun failed workflow run
- Batch D (workflow + Projects v2): inspect workflow/run -> control rerun/cancel -> inspect artifacts -> read/update Projects v2

See `docs/guides/roadmap-golden-flows.md` for copy-paste command sequences.

For exact routing/input/output contracts, see `packages/core/src/core/registry/cards/*.yaml`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, and PR guidelines.

## License

MIT © Arye Kogan
