# Library API Guide

Use ghx programmatically in your Node.js or TypeScript applications.

## Installation

```bash
npm install @ghx-dev/core
```

## Basic Usage

### Execute a Capability

```ts
import {
  createGithubClientFromToken,
  executeTask,
  executeTasks,
} from "@ghx-dev/core"

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

## Capability Discovery

### List All Capabilities

```ts
import { listOperationCards } from "@ghx-dev/core"

const cards = listOperationCards()
cards.forEach((card) => {
  console.log(`${card.capability_id} — ${card.description}`)
})
```

Output:

```text
repo.view — Get repository metadata
issue.create — Create an issue
pr.list — List pull requests
...
```

### Get Details on a Specific Capability

```ts
import { getOperationCard } from "@ghx-dev/core"

const card = getOperationCard("repo.view")
if (card) {
  console.log("Required inputs:", card.input_schema.required)
  console.log("Output fields:", Object.keys(card.output_schema.properties))
}
```

## Result Envelope

Every call returns a `ResultEnvelope<TData>`:

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
  }
}
```

### Handling Success

```ts
if (result.ok) {
  // data is available
  const repoId = result.data.id
  const route = result.meta.route_used // "cli" or "graphql"
}
```

### Handling Errors

```ts
if (!result.ok) {
  const { code, message, retryable } = result.error!
  console.error(`[${code}] ${message}`)

  if (retryable) {
    // Safe to retry
    console.log("Attempting retry...")
  }
}
```

## Typed Execution

```ts
// Define your input type
interface RepoViewInput {
  owner: string
  name: string
}

// Execute with types
const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } as RepoViewInput },
  { githubClient, githubToken: token },
)

if (result.ok) {
  // result.data is typed based on the capability's output schema
  const { id, name, nameWithOwner } = result.data
}
```

## Creating a GitHub Client

### From Token String

```ts
import { createGithubClientFromToken } from "@ghx-dev/core"

const githubClient = createGithubClientFromToken(process.env.GITHUB_TOKEN!)
```

### From Custom Transport

For custom GraphQL logic, middleware, or enterprise deployments:

```ts
import { createGithubClient } from "@ghx-dev/core"

const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    // Your custom logic here
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })

    const payload = (await response.json()) as {
      data?: TData
      errors?: Array<{ message?: string }>
    }

    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "GraphQL error")
    }
    if (payload.data === undefined) {
      throw new Error("GraphQL response missing data")
    }
    return payload.data
  },
})
```

See [Custom GraphQL Transport](custom-graphql-transport.md) for more examples.

## Common Patterns

### Atomic chain (mutations)

For mutations that must share a single HTTP round-trip — e.g., updating labels and assignees
on the same issue — use `executeTasks()`. All steps are pre-flight validated before any HTTP
call is made, and the chain executes in at most 2 network round-trips.

> **For mutations that must share a single HTTP round-trip, use `executeTasks`.**

```ts
import { executeTasks } from "@ghx-dev/core"

const chain = await executeTasks(
  [
    { task: "issue.labels.set", input: { issueId: "I_kwDOOx...", labels: ["bug"] } },
    { task: "issue.assignees.set", input: { issueId: "I_kwDOOx...", assignees: ["octocat"] } },
  ],
  { githubClient, githubToken: token },
)

if (chain.status === "success") {
  console.log(`All ${chain.meta.succeeded} steps succeeded`)
} else if (chain.status === "partial") {
  console.log(`${chain.meta.succeeded}/${chain.meta.total} steps succeeded`)
  chain.results.filter((r) => !r.ok).forEach((r) => {
    console.error(`Step ${r.task} failed: ${r.error?.message}`)
  })
} else {
  console.error("Chain failed:", chain.results[0]?.error?.message)
}
```

### Parallel queries

For independent read-only operations (queries) that don't need atomicity, use `Promise.all`:

```ts
const tasks = [
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { task: "repo.view", input: { owner: "another", name: "repo" } },
]

const results = await Promise.all(
  tasks.map((task) =>
    executeTask(task, { githubClient, githubToken: token }),
  ),
)

results.forEach((result) => {
  if (result.ok) {
    console.log(`${result.data.nameWithOwner} — ${result.data.description}`)
  }
})
```

### Retry on Retryable Errors

```ts
async function executeWithRetry(
  task: string,
  input: Record<string, unknown>,
  maxRetries: number = 3,
) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await executeTask(
      { task, input },
      { githubClient, githubToken: token },
    )

    if (result.ok || !result.error?.retryable) {
      return result
    }

    if (i < maxRetries - 1) {
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }

  throw new Error(`Max retries exceeded for task: ${task}`)
}
```

### Type-Safe Wrapper

```ts
import type { ResultEnvelope } from "@ghx-dev/core"

async function fetchRepo(owner: string, name: string) {
  return executeTask(
    { task: "repo.view", input: { owner, name } },
    { githubClient, githubToken: token },
  ) as Promise<
    ResultEnvelope<{
      id: string
      name: string
      nameWithOwner: string
      description: string
      isPrivate: boolean
    }>
  >
}

const result = await fetchRepo("aryeko", "ghx")
if (result.ok) {
  console.log(result.data.isPrivate)
}
```

## Error Handling

```ts
import type { ResultError } from "@ghx-dev/core"

async function handleError(error: ResultError) {
  switch (error.code) {
    case "AUTH":
      console.error("Authentication failed. Check your GITHUB_TOKEN.")
      break
    case "RATE_LIMIT":
      console.error("Rate limited. Wait before retrying.")
      break
    case "VALIDATION":
      console.error("Invalid input:", error.details)
      break
    case "NOT_FOUND":
      console.error("Resource not found:", error.message)
      break
    default:
      console.error(`Error [${error.code}]: ${error.message}`)
  }
}

const result = await executeTask(task, deps)
if (!result.ok) {
  await handleError(result.error!)
}
```

## Public API Reference

### Root Exports (`@ghx-dev/core`)

- `executeTask(request, deps)` — Execute a single capability
- `executeTasks(requests, deps)` — Execute a chain of capabilities atomically (≤2 HTTP round-trips)
- `createGithubClientFromToken(token)` — Create a client from a token
- `createGithubClient(transport)` — Create a client from a custom transport
- `listOperationCards()` — Get all capability cards
- `getOperationCard(id)` — Get a specific card
- `createSafeCliCommandRunner()` — Custom CLI execution

**Types:**

- `TaskRequest` — Capability request shape
- `ResultEnvelope<TData>` — Response shape for a single capability
- `ChainResultEnvelope` — Response shape for `executeTasks()`
- `ChainStepResult` — Per-step result in a chain
- `ChainStatus` — `"success"` | `"partial"` | `"failed"`
- `ResultError` — Error shape
- `ResultMeta` — Metadata shape
- `RouteSource` — Route type: "cli" | "graphql" | "rest"

### Environment Variables

- `GITHUB_TOKEN` — GitHub PAT or fine-grained token
- `GH_TOKEN` — Alternative to `GITHUB_TOKEN`
- `GITHUB_GRAPHQL_URL` — Override GraphQL endpoint
- `GH_HOST` — GitHub Enterprise host

---

See [Understanding the Result Envelope](result-envelope.md) for envelope
structures, and [Error Handling & Codes](error-handling.md) for error handling
strategies.
