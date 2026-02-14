# @ghx-dev/core

<p align="center">
  <img src="https://raw.githubusercontent.com/aryeko/ghx/main/assets/branding/social/ghx-social-dark-1280x640.png" alt="ghx social preview" width="720">
</p>

[![npm version](https://img.shields.io/npm/v/%40ghx-dev%2Fcore)](https://www.npmjs.com/package/@ghx-dev/core)
[![npm downloads](https://img.shields.io/npm/dm/%40ghx-dev%2Fcore)](https://www.npmjs.com/package/@ghx-dev/core)
[![CI (main)](https://github.com/aryeko/ghx/actions/workflows/ci-main.yml/badge.svg)](https://github.com/aryeko/ghx/actions/workflows/ci-main.yml)
[![codecov](https://codecov.io/gh/aryeko/ghx/graph/badge.svg?token=KBIGR138V7)](https://codecov.io/gh/aryeko/ghx)
[![License](https://img.shields.io/npm/l/%40ghx-dev%2Fcore)](https://github.com/aryeko/ghx/blob/main/LICENSE)

Public ghx package: CLI-first GitHub execution router for AI agents.

`@ghx-dev/core` routes GitHub capabilities across CLI and GraphQL, validates inputs/outputs against operation cards, and returns a stable envelope contract for deterministic agent automation.

## Why @ghx-dev/core

- Stable execution contract: `{ ok, data, error, meta }`
- Deterministic route planning (`preferred` then ordered `fallbacks`)
- Runtime schema validation for capability input/output
- Structured error taxonomy for reliable automation behavior
- Agent-facing exports for capability discovery and execution wrappers

## Installation

Requirements:

- Node.js `22+`
- `gh` CLI authenticated for CLI capability execution (`gh auth status`)

CLI without global install:

```bash
npx @ghx-dev/core capabilities list
```

CLI global install:

```bash
npm i -g @ghx-dev/core
```

Library install:

```bash
pnpm add @ghx-dev/core
```

Alternative package managers:

```bash
npm i @ghx-dev/core
# or
yarn add @ghx-dev/core
```

## Quick Start (CLI)

Set GitHub token (`GITHUB_TOKEN` or `GH_TOKEN`) and run capabilities:

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core capabilities explain repo.view
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Setup helper for Claude Code skill installation:

```bash
npx @ghx-dev/core setup --platform claude-code --scope project --yes
npx @ghx-dev/core setup --platform claude-code --scope project --verify
```

If installed globally, replace `npx @ghx-dev/core` with `ghx`.

## Quick Start (Library API)

```ts
import { createGithubClient, executeTask } from "@ghx-dev/core"

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

## Agent Tools (`@ghx-dev/core/agent`)

```ts
import {
  createExecuteTool,
  explainCapability,
  listCapabilities,
  MAIN_SKILL_TEXT,
} from "@ghx-dev/core/agent"

const executeTool = createExecuteTool({
  executeTask: async (request) => {
    return { ok: true, data: request, meta: { capability_id: request.task } }
  },
})

console.log(MAIN_SKILL_TEXT)
console.log(listCapabilities())
console.log(explainCapability("repo.view"))
await executeTool.execute("repo.view", { owner: "aryeko", name: "ghx" })
```

## Capability Groups

- Repository + issues: `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`
- PR read + diagnostics: comments/reviews/diff/checks/mergeability + check annotations and workflow job logs
- PR execution: review submit, merge, rerun checks, request reviewers, assign users, update branch
- Issue lifecycle: create/update/close/reopen/delete, labels/assignees/milestones, issue relations/dependencies
- Release + delivery: release list/get/create/update/publish and workflow dispatch/rerun controls
- Workflow + projects v2: workflow metadata, run controls/artifacts, projects v2 read/update operations
- Repo metadata: labels and issue types

For exact capability contracts, see https://github.com/aryeko/ghx/tree/main/packages/core/src/core/registry/cards.

## CLI Environment Variables

- `GITHUB_TOKEN` or `GH_TOKEN` (required)
- `GITHUB_GRAPHQL_URL` (optional override)
- `GH_HOST` (optional; used to derive enterprise GraphQL endpoint)

## Security and Permissions

- Start with least privilege and grant only what your capability set needs.
- For quick local testing, a classic PAT with `repo` scope is the simplest route.
- For production agents, prefer fine-grained tokens with read permissions first (`Metadata`, `Contents`, `Pull requests`, `Issues`, `Actions`, `Projects`) and add writes only where needed.

## Compatibility

- Node.js `22+`
- GitHub Cloud and GitHub Enterprise hosts (`GH_HOST` supported)
- Route adapters currently used: CLI and GraphQL

## Public Exports

Root (`@ghx-dev/core`):

- `executeTask`
- `createGithubClient`, `createGraphqlClient`
- `listOperationCards`, `getOperationCard`
- `createSafeCliCommandRunner`
- Core result/task types (`TaskRequest`, `ResultEnvelope`, `ResultError`, `ResultMeta`, `AttemptMeta`, `RouteSource`, `RouteReasonCode`)

Subpaths:

- `@ghx-dev/core/agent` - agent tooling exports
- `@ghx-dev/core/cli` - CLI entrypoint

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
- Operation card registry: https://github.com/aryeko/ghx/blob/main/docs/architecture/operation-card-registry.md
- Publishing guide: https://github.com/aryeko/ghx/blob/main/docs/guides/publishing.md

## License

MIT - https://github.com/aryeko/ghx/blob/main/LICENSE
