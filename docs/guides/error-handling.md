# Error Handling & Codes

Reference for ghx error codes and troubleshooting strategies.

## Error Codes

Every error has a **code** that identifies its category. Use codes to handle
errors programmatically.

### AUTH

**Meaning:** Authentication failed.

**Common causes:**

- Missing or invalid `GITHUB_TOKEN`
- Token lacks required permissions
- Token has expired

**Handling:**

```ts
if (result.error?.code === "AUTH") {
  console.error("Authentication failed. Check your GITHUB_TOKEN.")
}
```

**How to fix:**

1. Verify token exists:
   ```bash
   echo $GITHUB_TOKEN
   ```

2. Test authentication:
   ```bash
   gh auth status
   ```

3. Create a new token:
   - [GitHub CLI fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
   - Classic PAT scopes: `repo`, `workflow`, `admin:org_hook`

4. Set the token:
   ```bash
   export GITHUB_TOKEN=ghp_...
   ```

**Retryable:** No — Fix credentials, then retry.

### NOT_FOUND

**Meaning:** Resource not found.

**Common causes:**

- Repository doesn't exist
- Issue/PR doesn't exist
- User doesn't have access

**Handling:**

```ts
if (result.error?.code === "NOT_FOUND") {
  console.error("Resource not found:", result.error.message)
}
```

**How to fix:**

1. Verify the resource exists
2. Check owner/name spelling
3. For private repos, verify token has access

Example:

```bash
# Check if repo exists
ghx run repo.view --input '{"owner":"owner","name":"repo"}'
```

**Retryable:** No — Resource doesn't exist.

### VALIDATION

**Meaning:** Input validation failed.

**Common causes:**

- Missing required fields
- Wrong field type (e.g., string instead of number)
- Invalid field value (e.g., empty string)

**Handling:**

```ts
if (result.error?.code === "VALIDATION") {
  console.error("Invalid input:", result.error.details)
  // details: { owner: "missing", name: "missing" }
}
```

**How to fix:**

1. Check the error details:
   ```ts
   console.log(result.error?.details)
   ```

2. Understand required fields:
   ```bash
   ghx capabilities explain repo.view
   # Shows: required_inputs: ["owner", "name"]
   ```

3. Provide all required fields with correct types

Example:

```bash
# Missing 'name' field
ghx run repo.view --input '{"owner":"aryeko"}'
# Error: VALIDATION - "name" is required

# Correct:
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

**Retryable:** No — Fix input, then retry.

### RATE_LIMIT

**Meaning:** GitHub API rate limit exceeded.

**Common causes:**

- Too many requests in a short period
- Quota exhausted (GitHub tracks per-endpoint limits)

**Handling:**

```ts
if (result.error?.code === "RATE_LIMIT") {
  console.error("Rate limited. Wait 60+ seconds before retrying.")
}
```

**How to fix:**

1. Wait 60+ seconds (default rate limit reset)
2. Retry the request
3. For future: batch requests, reduce request frequency

**Exponential backoff:**

```ts
async function executeWithBackoff(task, input, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await executeTask(task, input)

    if (result.ok || result.error?.code !== "RATE_LIMIT") {
      return result
    }

    // Exponential backoff: 2s, 4s, 8s, ...
    const delay = 1000 * Math.pow(2, i)
    console.log(`Rate limited. Waiting ${delay}ms...`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}
```

**Retryable:** Yes — Wait, then retry.

### NETWORK

**Meaning:** Network error (connection issue, timeout).

**Common causes:**

- No internet connection
- GitHub API temporarily down
- Network timeout
- DNS resolution failure

**Handling:**

```ts
if (result.error?.code === "NETWORK") {
  console.error("Network error:", result.error.message)
}
```

**How to fix:**

1. Check internet connection:
   ```bash
   ping api.github.com
   ```

2. Check GitHub status: https://www.githubstatus.com/

3. Retry (with exponential backoff)

**Retryable:** Yes — Retry immediately or with backoff.

### SERVER

**Meaning:** GitHub server error (5xx status).

**Common causes:**

- GitHub experiencing outage or degradation
- Transient server error

**Handling:**

```ts
if (result.error?.code === "SERVER") {
  console.error("GitHub server error:", result.error.message)
}
```

**How to fix:**

1. Check GitHub status: https://www.githubstatus.com/

2. Retry with exponential backoff

3. If persistent, wait for GitHub to resolve

**Retryable:** Yes — Retry immediately or with backoff.

### ADAPTER_UNSUPPORTED

**Meaning:** Execution route not implemented for this capability.

**Common causes:**

- REST adapter not yet implemented (stub only)
- Capability doesn't support requested route

**Handling:**

```ts
if (result.error?.code === "ADAPTER_UNSUPPORTED") {
  console.error("Route not supported for this capability")
}
```

**Note:** ghx automatically falls back to other routes, so you'll rarely see
this.

**Retryable:** No — This capability doesn't support that route.

### UNKNOWN

**Meaning:** Unclassified error.

**Common causes:**

- Unexpected error condition
- Error message doesn't match known patterns

**Handling:**

```ts
if (result.error?.code === "UNKNOWN") {
  console.error("Unknown error:", result.error.message)
}
```

**How to debug:**

1. Log the full error object:
   ```ts
   console.log(JSON.stringify(result.error, null, 2))
   ```

2. Check the message for clues
3. Report on [GitHub Issues](https://github.com/aryeko/ghx/issues)

**Retryable:** No (but you can try again cautiously).

## Retryability Summary

| Code | Retryable | Wait? | Strategy |
|------|-----------|-------|----------|
| `AUTH` | No | Fix credentials | Re-authenticate |
| `NOT_FOUND` | No | No | Verify resource |
| `VALIDATION` | No | Fix input | Check required fields |
| `RATE_LIMIT` | Yes | Yes (60s) | Exponential backoff |
| `NETWORK` | Yes | Optional | Retry, check connection |
| `SERVER` | Yes | Optional | Retry with backoff |
| `ADAPTER_UNSUPPORTED` | No | No | Use different route |
| `UNKNOWN` | No | Maybe | Debug & retry cautiously |

## Debugging Strategies

### 1. Log Everything

```ts
const result = await executeTask(task, input)

if (!result.ok) {
  console.error("Error details:")
  console.error("  Code:", result.error?.code)
  console.error("  Message:", result.error?.message)
  console.error("  Retryable:", result.error?.retryable)
  console.error("  Details:", result.error?.details)
  console.error("Meta:")
  console.error("  Route used:", result.meta.route_used)
  console.error("  Reason:", result.meta.reason)
  console.error("  Attempts:", result.meta.attempts)
}
```

### 2. Check Metadata for Routing Info

```ts
if (result.meta.attempts) {
  console.log("Route history:")
  result.meta.attempts.forEach((attempt) => {
    console.log(
      `  ${attempt.route}: ${attempt.status} (${attempt.error_code}), ${attempt.duration_ms}ms`,
    )
  })
}
```

### 3. Test with CLI

Reproduce issues using the CLI:

```bash
npx ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

### 4. Verify Prerequisites

```bash
# Check gh CLI
gh auth status

# Check token
echo $GITHUB_TOKEN

# Check Node.js version
node --version  # Should be 22+
```

### 5. Check GitHub Status

https://www.githubstatus.com/ — See if GitHub is experiencing incidents.

## Error Handling Patterns

### Pattern: Fail Fast

```ts
async function executeOrThrow(task, input) {
  const result = await executeTask(task, input)

  if (!result.ok) {
    throw new Error(
      `[${result.error?.code}] ${result.error?.message}`,
    )
  }

  return result.data
}

try {
  const repo = await executeOrThrow("repo.view", input)
} catch (error) {
  console.error(error.message)
}
```

### Pattern: Conditional Retry

```ts
async function executeWithRetry(task, input, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await executeTask(task, input)

    if (result.ok) {
      return result.data
    }

    if (!result.error?.retryable || i === maxRetries - 1) {
      throw new Error(
        `[${result.error?.code}] ${result.error?.message}`,
      )
    }

    // Exponential backoff
    const delay = 1000 * Math.pow(2, i)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}
```

### Pattern: Graceful Degradation

```ts
async function fetchRepoWithFallback(owner, name) {
  try {
    const result = await executeTask("repo.view", { owner, name })

    if (result.ok) {
      return result.data
    }

    if (result.error?.code === "NOT_FOUND") {
      return null // Repository doesn't exist
    }

    if (result.error?.code === "AUTH") {
      console.warn("Not authenticated; showing limited info")
      return { owner, name, isPrivate: null }
    }

    throw new Error(`[${result.error?.code}] ${result.error?.message}`)
  } catch (error) {
    console.error("Failed to fetch repo:", error)
    return null
  }
}
```

### Pattern: User-Friendly Messages

```ts
function getUserMessage(error) {
  switch (error?.code) {
    case "AUTH":
      return "Please check your GitHub authentication token."
    case "NOT_FOUND":
      return `Could not find: ${error.message}`
    case "VALIDATION":
      return `Invalid input: ${Object.keys(error.details || {}).join(", ")}`
    case "RATE_LIMIT":
      return "GitHub API is busy. Please wait a moment and try again."
    case "NETWORK":
      return "Network error. Please check your connection."
    case "SERVER":
      return "GitHub is experiencing issues. Please try again soon."
    default:
      return `An error occurred: ${error?.message}`
  }
}

const result = await executeTask(task, input)
if (!result.ok) {
  console.error(getUserMessage(result.error))
}
```

## Troubleshooting Checklist

- [ ] `GITHUB_TOKEN` is set and valid (`gh auth status`)
- [ ] Required inputs are provided (check with `ghx capabilities explain`)
- [ ] Resource exists (check directly in GitHub web UI)
- [ ] Not rate limited (wait 60+ seconds if you see `RATE_LIMIT`)
- [ ] Network connection is stable (ping api.github.com)
- [ ] GitHub is not experiencing outage (check githubstatus.com)
- [ ] Node.js is 22+ (`node --version`)
- [ ] `gh` CLI is installed (`which gh`)

---

See [Understanding the Result Envelope](result-envelope.md) for response
structures, and [How Routing Works](routing-explained.md) for understanding
routing decisions.
