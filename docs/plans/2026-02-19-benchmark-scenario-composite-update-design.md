# Benchmark Scenario Update: Composite Capabilities + CI Log Diagnosis

**Date:** 2026-02-19
**Status:** Approved
**Scope:** `packages/benchmark/scenarios/workflows/`

## Context

Four PRs merged to main today introduce composite capabilities and expanded workflow tooling:

- **#55** — Composite capabilities: `pr.threads.composite`, `issue.triage.composite`, `issue.update.composite`
- **#57** — CLI adapter split into domain modules (internal; transparent to scenarios)
- **#54** — GQL drift checks offline (tooling; transparent to scenarios)
- **#53** — GQL lazy-loaded domain modules (internal; transparent to scenarios)

The benchmark scenarios' `expected_capabilities` arrays must reflect the new atomic→composite promotion and the expanded CI diagnosis flow.

## Approach

Minimal delta (Approach A): update `expected_capabilities` and prompts only. Checkpoints remain outcome-based and are unchanged. No versioned scenario variants.

## Changes Per Scenario

### `pr-fix-review-comments-wf-001`

- **`expected_capabilities`:** remove `pr.thread.reply`, `pr.thread.resolve`; add `pr.threads.composite`
- **Prompt:** unchanged
- **Checkpoints:** unchanged (`all_threads_resolved` via `pr.thread.list` with `unresolvedOnly: true`)

```json
"expected_capabilities": ["pr.view", "pr.thread.list", "pr.threads.composite"]
```

### `issue-triage-comment-wf-001`

- **`expected_capabilities`:** remove `issue.labels.update`, `issue.comments.create`; add `issue.triage.composite`
- **Prompt:** unchanged
- **Checkpoints:** unchanged (`comment_added` via `issue.comments.list`)
- **Note:** `issue.triage.composite` requires `issueId` (node ID). Agent must call `issue.view` first — already in expected capabilities.

```json
"expected_capabilities": ["issue.view", "issue.triage.composite"]
```

### `pr-review-comment-wf-001`

No changes. `pr.review.submit` moving to GQL-only is transparent to the scenario.

### `ci-diagnose-run-wf-001`

- **`expected_capabilities`:** add `workflow.job.logs.get`
- **Prompt:** expanded to require fetching job logs and surfacing top error lines
- **Checkpoints:** unchanged — dynamic `jobId` makes a logs-specific checkpoint impractical without fixture bindings

```json
"expected_capabilities": ["workflow.run.view", "workflow.job.logs.get"]
```

```
"prompt": "Workflow run {{runId}} in {{owner}}/{{name}} has failed. Get the run details to confirm its status and conclusion, identify which job failed, and fetch that job's logs to surface the top error lines."
```

## Out of Scope

- `issue.update.composite` — no existing scenario exercises multi-field issue updates; a new scenario would be needed
- Checkpoint enrichment for CI logs — requires dynamic `jobId` fixture bindings not currently supported
- Versioned scenario variants (`-wf-002`) — no regression comparison needed; composites fully replace atomics
