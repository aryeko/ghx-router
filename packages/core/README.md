# @ghx/core

[![npm version](https://img.shields.io/npm/v/%40ghx%2Fcore)](https://www.npmjs.com/package/@ghx/core)
[![npm downloads](https://img.shields.io/npm/dm/%40ghx%2Fcore)](https://www.npmjs.com/package/@ghx/core)
[![License](https://img.shields.io/npm/l/%40ghx%2Fcore)](https://github.com/aryeko/ghx/blob/main/LICENSE)

CLI-first GitHub execution router for agents.

`@ghx/core` exposes a typed execution engine that routes GitHub tasks across CLI and GraphQL, validates inputs/outputs against operation-card schemas, and returns a stable result envelope for deterministic agent workflows.

## Why @ghx/core

- **Stable contract**: every task returns `{ ok, data, error, meta }`
- **Route-aware execution**: preferred route + fallback routes per capability
- **Schema validation**: runtime validation for task input/output
- **Typed clients**: typed GraphQL/GitHub client helpers
- **Agent-ready tools**: subpath exports for capability listing/explanation/execution wrappers

## Installation

```bash
pnpm add @ghx/core
```

Alternative package managers:

```bash
npm i @ghx/core
# or
yarn add @ghx/core
```

## Quick Start (Library API)

```ts
import { createGithubClient, executeTask } from "@ghx/core"

const githubToken = process.env.GITHUB_TOKEN

if (!githubToken) {
  throw new Error("Missing GITHUB_TOKEN")
}

const githubClient = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })

    const payload = (await response.json()) as {
      data?: TData
      errors?: Array<{ message?: string }>
      message?: string
    }

    if (!response.ok) {
      throw new Error(payload.message ?? `GraphQL request failed (${response.status})`)
    }

    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "GraphQL returned errors")
    }

    if (payload.data === undefined) {
      throw new Error("GraphQL response missing data")
    }

    return payload.data
  },
})

const result = await executeTask(
  {
    task: "repo.view",
    input: {
      owner: "aryeko",
      name: "ghx",
    },
  },
  {
    githubClient,
    githubToken,
  },
)

if (!result.ok) {
  throw new Error(`${result.error?.code}: ${result.error?.message}`)
}

console.log(result.data)
```

## Agent Tools (`@ghx/core/agent`)

```ts
import {
  createExecuteTool,
  explainCapability,
  listCapabilities,
  MAIN_SKILL_TEXT,
} from "@ghx/core/agent"

const executeTool = createExecuteTool({
  executeTask: async (request) => {
    // delegate to your runtime integration
    return { ok: true, data: request, meta: { capability_id: request.task } }
  },
})

console.log(MAIN_SKILL_TEXT)
console.log(listCapabilities())
console.log(explainCapability("repo.view"))
await executeTool.execute("repo.view", { owner: "aryeko", name: "ghx" })
```

## CLI

When installed globally (or executed via package manager), use:

```bash
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Environment variables used by the CLI path:

- `GITHUB_TOKEN` or `GH_TOKEN` (required)
- `GITHUB_GRAPHQL_URL` (optional override)
- `GH_HOST` (optional; used to derive enterprise GraphQL endpoint)

## Built-in Capabilities

- `repo.view` - fetch repository metadata
- `issue.view` - fetch a single issue
- `issue.list` - list repository issues
- `issue.comments.list` - list issue comments with pagination
- `pr.view` - fetch a single pull request
- `pr.list` - list pull requests
- `pr.comments.list` - list pull request review threads/comments
- `pr.reviews.list` - list pull request reviews
- `pr.diff.list_files` - list changed files in a pull request
- `pr.status.checks` - list pull request checks and summary counts
- `pr.checks.get_failed` - list failed pull request checks
- `pr.mergeability.view` - fetch mergeability and review decision signals
- `pr.comment.reply` - reply to a pull request review thread
- `pr.comment.resolve` - resolve a pull request review thread
- `pr.comment.unresolve` - unresolve a pull request review thread
- `pr.ready_for_review.set` - mark draft/ready-for-review state
- `check_run.annotations.list` - list check run annotations
- `workflow_runs.list` - list workflow runs for a repository
- `workflow_run.jobs.list` - list jobs for a workflow run
- `workflow_job.logs.get` - fetch workflow job logs
- `workflow_job.logs.analyze` - analyze workflow job logs for error/warning summaries

## Public Exports

Root (`@ghx/core`):

- `executeTask`
- `createGithubClient`, `createGraphqlClient`
- `listOperationCards`, `getOperationCard`
- `createSafeCliCommandRunner`
- core result/task types (`TaskRequest`, `ResultEnvelope`, `ResultError`, `ResultMeta`, `AttemptMeta`, `RouteSource`, `RouteReasonCode`)

Subpaths:

- `@ghx/core/agent` - agent tooling exports
- `@ghx/core/cli` - CLI entrypoint

## Result Envelope

All execution paths resolve to:

```ts
type ResultEnvelope<TData = unknown> = {
  ok: boolean
  data?: TData
  error?: {
    code: string
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

## Documentation

- Architecture overview: https://github.com/aryeko/ghx/blob/main/docs/CODEMAPS/ARCHITECTURE.md
- Module map: https://github.com/aryeko/ghx/blob/main/docs/CODEMAPS/MODULES.md
- File map: https://github.com/aryeko/ghx/blob/main/docs/CODEMAPS/FILES.md
- Adding capabilities: https://github.com/aryeko/ghx/blob/main/docs/guides/adding-a-capability.md
- Publishing guide: https://github.com/aryeko/ghx/blob/main/docs/guides/publishing.md

## License

MIT - https://github.com/aryeko/ghx/blob/main/LICENSE
