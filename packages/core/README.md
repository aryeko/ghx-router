# @ghx-dev/core

<p align="center">
  <img src="https://raw.githubusercontent.com/aryeko/ghx/main/assets/branding/social/ghx-social-dark-1280x640.png" alt="ghx social preview" width="480">
</p>

[![npm version](https://img.shields.io/npm/v/%40ghx-dev%2Fcore)](https://www.npmjs.com/package/@ghx-dev/core)
[![npm downloads](https://img.shields.io/npm/dm/%40ghx-dev%2Fcore)](https://www.npmjs.com/package/@ghx-dev/core)
[![CI (main)](https://github.com/aryeko/ghx/actions/workflows/ci-main.yml/badge.svg)](https://github.com/aryeko/ghx/actions/workflows/ci-main.yml)
[![codecov](https://codecov.io/gh/aryeko/ghx/graph/badge.svg?token=KBIGR138V7)](https://codecov.io/gh/aryeko/ghx)
[![License](https://img.shields.io/npm/l/%40ghx-dev%2Fcore)](https://github.com/aryeko/ghx/blob/main/LICENSE)

Typed GitHub execution router for AI agents. Deterministic routing across CLI and GraphQL, runtime schema validation, and a stable result envelope -- so agents stop wasting tokens re-discovering GitHub API surfaces.

## Why ghx

Agents instructed to "use `gh` CLI" for common PR and issue operations waste significant tokens on research, trial-and-error, and output parsing. Benchmarked across 27 runs on standard PR workflows:

| Metric | Improvement |
|---|---|
| Active tokens | **-37%** fewer tokens consumed |
| Latency | **-32%** faster end-to-end |
| Tool calls | **-33%** fewer tool invocations |
| Success rate | **100%** (zero regressions) |

ghx eliminates the discovery phase: agents call typed capabilities, get validated results back in a stable envelope.

## Installation

Requirements: Node.js `22+`, `gh` CLI authenticated (`gh auth status`).

```bash
npm install @ghx-dev/core
```

Alternative package managers:

```bash
pnpm add @ghx-dev/core
# or
yarn add @ghx-dev/core
```

Or run directly without installing:

```bash
npx @ghx-dev/core capabilities list
```

Global CLI install:

```bash
npm i -g @ghx-dev/core
```

## Quick Start (CLI)

Set `GITHUB_TOKEN` or `GH_TOKEN` in your environment, then:

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core capabilities explain repo.view
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

If installed globally, replace `npx @ghx-dev/core` with `ghx`.

Every capability returns a stable envelope:

```json
{
  "ok": true,
  "data": {
    "id": "R_kgDOOx...",
    "name": "ghx",
    "nameWithOwner": "aryeko/ghx"
  },
  "error": null,
  "meta": {
    "capability_id": "repo.view",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

## Quick Start (Library API)

```ts
import { createGithubClientFromToken, executeTask } from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: token },
)

if (result.ok) {
  console.log(result.data)
} else {
  console.error(result.error?.code, result.error?.message)
}
```

Need a custom GraphQL transport? Use `createGithubClient(transport)` instead -- see the [advanced usage section](#custom-graphql-transport).

## Agent Onboarding

Install ghx as a project skill for Claude Code:

```bash
npx @ghx-dev/core setup --scope project --yes
npx @ghx-dev/core setup --scope project --verify
```

### Setup Skill Source

The canonical setup skill content is stored in:

- `skills/using-ghx/SKILL.md` (package root)

During build/publish it is copied to:

- `dist/skills/using-ghx/SKILL.md`

`ghx setup` writes this content to `.agents/skills/ghx/SKILL.md` in user or project scope.

## Agent Tools

```ts
import {
  createExecuteTool,
  createGithubClientFromToken,
  executeTask,
  explainCapability,
  listCapabilities,
} from "@ghx-dev/core"

// Wire the execute tool to the real engine
const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

const tool = createExecuteTool({
  executeTask: (request) => executeTask(request, { githubClient, githubToken: token }),
})

// Discover and execute capabilities
console.log(listCapabilities())
console.log(explainCapability("repo.view"))
const result = await tool.execute("repo.view", { owner: "aryeko", name: "ghx" })
```

## 66 Capabilities

**Repository** -- `repo.view`, `repo.labels.list`, `repo.issue_types.list`

**Issues** -- `issue.view`, `issue.list`, `issue.comments.list`, `issue.create`, `issue.update`, `issue.close`, `issue.reopen`, `issue.delete`, `issue.labels.update`, `issue.assignees.update`, `issue.milestone.set`, `issue.comments.create`, `issue.linked_prs.list`, `issue.relations.get`, `issue.parent.set`, `issue.parent.remove`, `issue.blocked_by.add`, `issue.blocked_by.remove`

**Pull Requests (read)** -- `pr.view`, `pr.list`, `pr.comments.list`, `pr.reviews.list`, `pr.diff.list_files`, `pr.status.checks`, `pr.checks.get_failed`, `pr.mergeability.view`

**Pull Requests (execute)** -- `pr.comment.reply`, `pr.comment.resolve`, `pr.comment.unresolve`, `pr.ready_for_review.set`, `pr.review.submit_approve`, `pr.review.submit_request_changes`, `pr.review.submit_comment`, `pr.merge.execute`, `pr.checks.rerun_failed`, `pr.checks.rerun_all`, `pr.reviewers.request`, `pr.assignees.update`, `pr.branch.update`

**CI Diagnostics** -- `check_run.annotations.list`, `workflow_runs.list`, `workflow_run.jobs.list`, `workflow_job.logs.get`, `workflow_job.logs.analyze`

**Releases** -- `release.list`, `release.get`, `release.create_draft`, `release.update`, `release.publish_draft`

**Workflow Controls** -- `workflow.list`, `workflow.get`, `workflow_dispatch.run`, `workflow_run.get`, `workflow_run.rerun_failed`, `workflow_run.rerun_all`, `workflow_run.cancel`, `workflow_run.artifacts.list`

**Projects v2** -- `project_v2.org.get`, `project_v2.user.get`, `project_v2.fields.list`, `project_v2.items.list`, `project_v2.item.add_issue`, `project_v2.item.field.update`

For exact input/output contracts, see the [operation card registry](https://github.com/aryeko/ghx/tree/main/packages/core/src/core/registry/cards).

## Result Envelope

All execution paths resolve to:

```ts
type ResultEnvelope<TData = unknown> = {
  ok: boolean
  data?: TData
  error?: {
    code: string      // AUTH, NOT_FOUND, RATE_LIMIT, VALIDATION, ...
    message: string
    retryable: boolean
    details?: Record<string, unknown>
  }
  meta: {
    capability_id: string
    route_used?: "cli" | "graphql" | "rest"
    reason?: string
    attempts?: Array<{
      route: "cli" | "graphql" | "rest"
      status: "success" | "error" | "skipped"
      error_code?: string
      duration_ms?: number
    }>
  }
}
```

## Environment Variables

- `GITHUB_TOKEN` or `GH_TOKEN` (required)
- `GITHUB_GRAPHQL_URL` (optional; override GraphQL endpoint)
- `GH_HOST` (optional; derives enterprise GraphQL endpoint)

## Security and Permissions

- Start with least privilege and grant only what your capability set needs.
- For quick local testing, a classic PAT with `repo` scope is the simplest route.
- For production agents, prefer fine-grained tokens with read permissions first (`Metadata`, `Contents`, `Pull requests`, `Issues`, `Actions`, `Projects`) and add writes only where needed.

## Compatibility

- Node.js `22+`
- GitHub Cloud and GitHub Enterprise hosts (`GH_HOST` supported)
- Route adapters: CLI and GraphQL

## Public Exports

Root (`@ghx-dev/core`):

- `executeTask` -- run a capability
- `createGithubClientFromToken` -- create a client from a token string
- `createGithubClient`, `createGraphqlClient` -- create clients from a custom transport
- `listOperationCards`, `getOperationCard` -- inspect capability registry
- `createSafeCliCommandRunner` -- custom CLI execution
- Types: `TaskRequest`, `ResultEnvelope`, `ResultError`, `ResultMeta`, `AttemptMeta`, `RouteSource`, `RouteReasonCode`, `TokenClientOptions`

Subpaths:

- `@ghx-dev/core/cli` -- CLI entrypoint

## Custom GraphQL Transport

For full control over the GraphQL layer, pass your own transport to `createGithubClient`:

```ts
import { createGithubClient, executeTask } from "@ghx-dev/core"

const githubClient = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })
    const payload = (await response.json()) as { data?: TData; errors?: Array<{ message?: string }> }
    if (payload.errors?.length) throw new Error(payload.errors[0]?.message ?? "GraphQL error")
    if (payload.data === undefined) throw new Error("GraphQL response missing data")
    return payload.data
  },
})

const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: process.env.GITHUB_TOKEN },
)
```

## Documentation

- [Documentation Hub](https://github.com/aryeko/ghx/blob/main/docs/README.md)
- [Architecture](https://github.com/aryeko/ghx/blob/main/docs/architecture/README.md)
- [Capabilities Reference](https://github.com/aryeko/ghx/blob/main/docs/capabilities/README.md)
- [Operation Cards](https://github.com/aryeko/ghx/blob/main/docs/architecture/operation-cards.md)
- [Publishing Guide](https://github.com/aryeko/ghx/blob/main/docs/contributing/publishing.md)

## License

MIT - https://github.com/aryeko/ghx/blob/main/LICENSE
