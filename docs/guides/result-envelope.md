# Understanding the Result Envelope

Every ghx call returns a stable response structure called the **result envelope**.
Learn how to parse and handle it.

## Structure

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

## Reading the Envelope

### Success Case

When `ok` is `true`:

```json
{
  "ok": true,
  "data": {
    "id": "R_kgDOOx...",
    "name": "ghx",
    "nameWithOwner": "aryeko/ghx",
    "description": "GitHub execution router for AI agents",
    "isPrivate": false
  },
  "error": null,
  "meta": {
    "capability_id": "repo.view",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

Extract the result:

```ts
if (result.ok) {
  const repoName = result.data.nameWithOwner
  const route = result.meta.route_used
}
```

### Error Case

When `ok` is `false`:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Repository not found",
    "retryable": false,
    "details": {
      "owner": "invalid-owner",
      "repo": "invalid-repo"
    }
  },
  "meta": {
    "capability_id": "repo.view",
    "route_used": "cli",
    "reason": "ROUTE_FAILED"
  }
}
```

Handle the error:

```ts
if (!result.ok) {
  const { code, message, retryable } = result.error!

  if (code === "NOT_FOUND") {
    console.error("Resource not found:", message)
  }

  if (retryable) {
    console.log("Safe to retry")
  }
}
```

## Field Reference

### `ok`

**Type:** `boolean`

True if the capability succeeded; false if it failed. Always check this first.

```ts
if (!result.ok) {
  // Handle error
}
```

### `data`

**Type:** `TData` (capability-specific)

The capability's output when `ok` is true. Null/undefined when `ok` is false.

Each capability defines its own `data` schema (e.g., `repo.view` returns repo
metadata; `issue.create` returns the created issue).

```ts
const issue = result.data // Typed based on capability
```

### `error.code`

**Type:** `string`

Normalized error code. One of:

- `AUTH` — Authentication failed
- `NOT_FOUND` — Resource not found
- `VALIDATION` — Input validation failed
- `RATE_LIMIT` — Rate limited by GitHub
- `NETWORK` — Network error
- `SERVER` — GitHub server error
- `ADAPTER_UNSUPPORTED` — Adapter not implemented
- `UNKNOWN` — Unknown error

Use this to handle errors programmatically:

```ts
switch (result.error?.code) {
  case "AUTH":
    console.error("Check your GITHUB_TOKEN")
    break
  case "RATE_LIMIT":
    console.error("Wait 60+ seconds before retrying")
    break
  case "VALIDATION":
    console.error("Invalid input:", result.error.details)
    break
}
```

See [Error Handling & Codes](error-handling.md) for detailed information on each
code.

### `error.message`

**Type:** `string`

Human-readable error description.

```ts
console.error(result.error?.message)
// "Repository not found"
```

### `error.retryable`

**Type:** `boolean`

Whether it's safe to retry the operation immediately.

Retryable errors:

- `RATE_LIMIT` — Wait, then retry
- `NETWORK` — Retry immediately
- `SERVER` — Retry immediately

Non-retryable errors:

- `AUTH` — Fix credentials, then retry
- `VALIDATION` — Fix input, then retry
- `NOT_FOUND` — Resource doesn't exist; don't retry
- `UNKNOWN` — Unknown cause; don't retry

```ts
if (result.error?.retryable) {
  console.log("Safe to retry immediately")
} else {
  console.log("Do not retry; fix the issue")
}
```

### `error.details`

**Type:** `Record<string, unknown>` (optional)

Additional debugging information. Present for validation errors.

```ts
if (result.error?.code === "VALIDATION") {
  console.error("Invalid fields:", result.error.details)
  // { owner: "missing", name: "missing" }
}
```

### `meta.capability_id`

**Type:** `string`

The capability that was executed (e.g., `repo.view`, `issue.create`).

```ts
console.log(`Executed: ${result.meta.capability_id}`)
```

### `meta.route_used`

**Type:** `"cli" | "graphql" | "rest"` (optional)

Which execution route handled the request:

- `cli` — Used the GitHub CLI (`gh` command)
- `graphql` — Used GitHub's GraphQL API
- `rest` — Used GitHub's REST API (stub)

```ts
if (result.meta.route_used === "cli") {
  console.log("Executed via CLI")
}
```

### `meta.reason`

**Type:** `string` (optional)

Why this route was chosen. Common reasons:

- `CARD_PREFERRED` — Preferred route in the capability card
- `CLI_NOT_AVAILABLE` — CLI not installed; fell back to GraphQL
- `CLI_UNAUTHENTICATED` — CLI not authenticated; fell back to GraphQL
- `ROUTE_FAILED` — Preferred route failed; tried fallback
- `ADAPTER_UNSUPPORTED` — Route not implemented

```ts
console.log(`Reason: ${result.meta.reason}`)
```

### `meta.attempts`

**Type:** `Array<AttemptMeta>` (optional)

History of route attempts when fallbacks were used. Each attempt includes:

- `route` — Route attempted
- `status` — Result of attempt: `"success"`, `"error"`, or `"skipped"`
- `error_code` — Error code if status is `"error"`
- `duration_ms` — How long the attempt took

```json
{
  "attempts": [
    {
      "route": "cli",
      "status": "error",
      "error_code": "CLI_NOT_AVAILABLE",
      "duration_ms": 245
    },
    {
      "route": "graphql",
      "status": "success",
      "duration_ms": 312
    }
  ]
}
```

Use this to understand routing behavior:

```ts
result.meta.attempts?.forEach((attempt) => {
  console.log(`${attempt.route}: ${attempt.status} (${attempt.duration_ms}ms)`)
})
```

## Patterns

### Check Success or Throw

```ts
function throwIfError(result: ResultEnvelope) {
  if (!result.ok) {
    throw new Error(
      `[${result.error?.code}] ${result.error?.message}`,
    )
  }
  return result.data
}

const repo = throwIfError(result)
```

### Conditional Retry

```ts
async function executeWithRetry(task, input) {
  const result = await executeTask(task, input)

  if (!result.ok && result.error?.retryable) {
    console.log("Retrying...")
    return executeTask(task, input)
  }

  return result
}
```

### Log Routing Decision

```ts
console.log(
  `Executed ${result.meta.capability_id} via ${result.meta.route_used} ` +
  `(${result.meta.reason})`,
)

if (result.meta.attempts) {
  result.meta.attempts.forEach((attempt) => {
    console.log(
      `  - ${attempt.route}: ${attempt.status} (${attempt.duration_ms}ms)`,
    )
  })
}
```

### Type-Safe Extraction

```ts
type RepoView = {
  id: string
  name: string
  nameWithOwner: string
  isPrivate: boolean
}

const result = await executeTask("repo.view", input)
const repo = result.ok ? (result.data as RepoView) : null

if (repo) {
  console.log(repo.nameWithOwner)
}
```

## Guarantees

The result envelope is **stable** and **predictable**:

1. **Always present** — Every call returns an envelope
2. **Always typed** — `ok` is always a boolean; `data` or `error` is present
3. **Never null** — Use `ok` to discriminate, not nullness checks
4. **Consistent across routes** — CLI and GraphQL return the same envelope shape

This means agents can:

- Parse responses reliably without guessing
- Handle errors systematically
- Make routing decisions from metadata
- Understand why operations succeeded or failed

---

See [Error Handling & Codes](error-handling.md) for detailed error handling
strategies, and [How Routing Works](routing-explained.md) for understanding why
certain routes are chosen.
