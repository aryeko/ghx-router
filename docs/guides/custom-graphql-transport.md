# Custom GraphQL Transport

Bring your own GraphQL client to ghx. Override the default implementation for
custom auth, middleware, enterprise deployments, or advanced use cases.

## When to Use Custom Transport

- **Enterprise GitHub** with custom authentication
- **Caching or middleware** (logging, rate limiting, retries)
- **Custom fetch logic** (proxies, connection pooling)
- **Monitoring or observability** (metrics, tracing)
- **Testing** (mock GraphQL responses)

## Basic Example

```ts
import { createGithubClient, executeTask } from "@ghx-dev/core"

const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
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

const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: process.env.GITHUB_TOKEN },
)
```

## Transport Interface

```ts
type GraphqlTransport = {
  execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData>
}
```

Your `execute` function receives:

- `query` — GraphQL query string
- `variables` — Query variables object
- **Returns:** Parsed response data (not the full GraphQL response)

## Examples

### Enterprise GitHub with Custom Auth

```ts
const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    const host = process.env.GITHUB_ENTERPRISE_HOST || "api.github.com"
    const endpoint =
      host === "api.github.com"
        ? "https://api.github.com/graphql"
        : `https://${host}/api/graphql`

    // Use a custom auth token from secrets manager
    const token = await getTokenFromSecretsManager()

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
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

### With Logging Middleware

```ts
const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    const startTime = Date.now()
    console.log("[GraphQL] Executing query")

    try {
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

      const duration = Date.now() - startTime
      console.log(`[GraphQL] Query completed in ${duration}ms`)

      if (payload.errors?.length) {
        throw new Error(payload.errors[0]?.message ?? "GraphQL error")
      }
      if (payload.data === undefined) {
        throw new Error("GraphQL response missing data")
      }
      return payload.data
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[GraphQL] Query failed after ${duration}ms:`, error)
      throw error
    }
  },
})
```

### With Request Caching

```ts
const cache = new Map<string, unknown>()

const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    const cacheKey = JSON.stringify({ query, variables })

    // Check cache
    if (cache.has(cacheKey)) {
      console.log("[GraphQL] Returning cached result")
      return cache.get(cacheKey) as TData
    }

    // Execute
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

    // Cache result
    cache.set(cacheKey, payload.data)
    return payload.data
  },
})
```

### With Rate Limit Tracking

```ts
type RateLimitInfo = {
  limit: number
  remaining: number
  resetAt: Date
}

let rateLimitInfo: RateLimitInfo | null = null

const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    if (
      rateLimitInfo &&
      rateLimitInfo.remaining === 0 &&
      rateLimitInfo.resetAt > new Date()
    ) {
      throw new Error(
        `Rate limited until ${rateLimitInfo.resetAt.toISOString()}`,
      )
    }

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

    // Extract rate limit info from response headers
    const limit = response.headers.get("x-ratelimit-limit")
    const remaining = response.headers.get("x-ratelimit-remaining")
    const reset = response.headers.get("x-ratelimit-reset")

    if (limit && remaining && reset) {
      rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        resetAt: new Date(parseInt(reset, 10) * 1000),
      }

      console.log(
        `[Rate Limit] ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`,
      )
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

### With Exponential Backoff Retry

```ts
async function executeWithRetry<TData>(
  query: string,
  variables?: Record<string, unknown>,
  maxRetries: number = 3,
): Promise<TData> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }

      const delay = 1000 * Math.pow(2, attempt - 1)
      console.log(
        `[GraphQL] Attempt ${attempt} failed, retrying in ${delay}ms...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error("Exhausted retries")
}

const githubClient = createGithubClient({
  execute: executeWithRetry,
})
```

### For Testing (Mock Responses)

```ts
const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    // Mock responses for tests
    if (query.includes("repository")) {
      return {
        repository: {
          id: "R_test",
          name: "test-repo",
          nameWithOwner: "test/test-repo",
        },
      } as TData
    }

    throw new Error(`Unexpected query: ${query}`)
  },
})
```

## Error Handling

Your transport must:

1. **Throw on errors** — ghx catches exceptions
2. **Return parsed data** — Not the raw GraphQL response
3. **Handle GraphQL errors** — Check `payload.errors`
4. **Validate data** — Ensure `payload.data` exists

```ts
const githubClient = createGithubClient({
  async execute<TData>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<TData> {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })

    // Check HTTP errors
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const payload = (await response.json()) as {
      data?: TData
      errors?: Array<{ message?: string }>
    }

    // Check GraphQL errors
    if (payload.errors?.length) {
      const message = payload.errors[0]?.message ?? "Unknown GraphQL error"
      throw new Error(`GraphQL error: ${message}`)
    }

    // Validate data
    if (payload.data === undefined) {
      throw new Error("GraphQL response missing data field")
    }

    return payload.data
  },
})
```

## Using the Custom Client

Once created, pass it to `executeTask`:

```ts
const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: process.env.GITHUB_TOKEN },
)
```

## Combining with CLI

You can use a custom GraphQL transport while still using CLI for preferred
routes:

```ts
const githubClient = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>) {
    // Your custom logic
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

// This will use CLI when preferred, and your custom transport for GraphQL
const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  {
    githubClient,
    githubToken: process.env.GITHUB_TOKEN,
  },
)
```

## Best Practices

1. **Handle errors gracefully** — Throw descriptive errors
2. **Log for debugging** — Add timestamps, durations, error details
3. **Cache when appropriate** — Reduce API calls where safe
4. **Respect rate limits** — Track and respect GitHub's rate limit headers
5. **Use exponential backoff** — For transient failures
6. **Keep middleware lightweight** — Don't block execution for long
7. **Test thoroughly** — Mock responses in tests

---

See [Library API](library-api.md) for other client creation options, and
[How Routing Works](routing-explained.md) for understanding when GraphQL is used.
