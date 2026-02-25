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

Agents instructed to "use `gh` CLI" for common PR and issue operations waste significant tokens on research, trial-and-error, and output parsing. Benchmarked across 40 runs on standard PR and issue workflows (MCP mode benchmark coming soon):

| Metric | Improvement |
|---|---|
| Tool calls | **-55%** (PR review), **-47%** (issue triage) |
| Active tokens | **-88%** (PR review), **-41%** (thread resolution) |
| Latency | **-57%** (PR review), **-26%** (thread resolution) |
| Success rate | **100%** both modes |

Full report: [Codex 5.3 Benchmark](https://github.com/aryeko/ghx/blob/main/reports/codex-5.3-benchmark/README.md)

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

## Chain: Batch Operations

Batch multiple operations into a single tool call:

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"issue.labels.remove","input":{"owner":"acme","name":"repo","issueNumber":42,"labels":["triage"]}},
  {"task":"issue.labels.add","input":{"owner":"acme","name":"repo","issueNumber":42,"labels":["enhancement"]}},
  {"task":"issue.comments.create","input":{"owner":"acme","name":"repo","issueNumber":42,"body":"Triaged."}}
]
EOF
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

Need a custom GraphQL transport? See [Custom GraphQL Transport](#custom-graphql-transport).

## Agent Onboarding

<details>
<summary>Install ghx as a project skill for Claude Code</summary>

```bash
npx @ghx-dev/core setup --scope project --yes
npx @ghx-dev/core setup --scope project --verify
```

The canonical setup skill content is stored in `skills/using-ghx/SKILL.md` (package root). During build/publish it is copied to `dist/skills/using-ghx/SKILL.md`. `ghx setup` writes this content to `.agents/skills/ghx/SKILL.md` in user or project scope.

</details>

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

## 70 Capabilities

| Domain | Count | Examples |
|---|---|---|
| Repository | 3 | `repo.view`, `repo.labels.list` |
| Issues | 23 | create/update/close, labels, assignees, milestones, relations |
| Pull Requests | 21 | diff, threads, reviews, checks, merge, branch update |
| Workflows and CI | 11 | runs, jobs, logs, dispatch, rerun, cancel, artifacts |
| Releases | 5 | view, list, create, update, publish |
| Projects v2 | 7 | items, fields, add/remove issues |

Full list: `ghx capabilities list` or [operation card registry](https://github.com/aryeko/ghx/tree/main/packages/core/src/core/registry/cards).

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

<details>
<summary>Public Exports</summary>

Root (`@ghx-dev/core`):

- `executeTask` -- run a capability
- `createGithubClientFromToken` -- create a client from a token string
- `createGithubClient`, `createGraphqlClient` -- create clients from a custom transport
- `listOperationCards`, `getOperationCard` -- inspect capability registry
- `createSafeCliCommandRunner` -- custom CLI execution
- Types: `TaskRequest`, `ResultEnvelope`, `ResultError`, `ResultMeta`, `AttemptMeta`, `RouteSource`, `RouteReasonCode`, `TokenClientOptions`

Subpaths:

- `@ghx-dev/core/cli` -- CLI entrypoint

</details>

<details>
<a id="custom-graphql-transport"></a>
<summary>Custom GraphQL Transport</summary>

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

</details>

## Documentation

- [Documentation Hub](https://github.com/aryeko/ghx/blob/main/docs/README.md)
- [Architecture](https://github.com/aryeko/ghx/blob/main/docs/architecture/README.md)
- [Capabilities Reference](https://github.com/aryeko/ghx/blob/main/docs/capabilities/README.md)
- [Operation Cards](https://github.com/aryeko/ghx/blob/main/docs/architecture/operation-cards.md)
- [Publishing Guide](https://github.com/aryeko/ghx/blob/main/docs/contributing/publishing.md)

## License

MIT - https://github.com/aryeko/ghx/blob/main/LICENSE
