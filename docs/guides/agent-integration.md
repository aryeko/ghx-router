# Agent Integration Guide

Add ghx to your AI agent (Claude Code, Claude, or custom LLM systems) to enable
reliable, typed GitHub operations.

## Quick Setup

### For Claude Code (Project Scope)

```bash
npx @ghx-dev/core setup --scope project --yes
```

This creates `.agents/skills/ghx/SKILL.md` with agent-friendly documentation.

Verify the installation:

```bash
npx @ghx-dev/core setup --scope project --verify
```

### For Custom Agents

Add ghx to your agent's tool/skill registry using the `@ghx-dev/core` exports.

## The Three Agent Tools

ghx provides three tools for agents:

### 1. `listCapabilities()`

Discover all 69 capabilities available.

**Usage:**

```ts
import { listCapabilities } from "@ghx-dev/core"

const capabilities = listCapabilities()
// Returns:
// [
//   { capability_id: "repo.view", description: "Get repository metadata" },
//   { capability_id: "issue.create", description: "Create an issue" },
//   ...
// ]
```

**Agent Prompt Guidance:**

> "Use `listCapabilities()` to discover what GitHub operations are available. Call
> this at the start of a task to understand what you can do."

### 2. `explainCapability(id)`

Get detailed information about a specific capability's input/output contract and
routing.

**Usage:**

```ts
import { explainCapability } from "@ghx-dev/core"

const explanation = explainCapability("repo.view")
// Returns:
// {
//   capability_id: "repo.view",
//   purpose: "Get repository metadata",
//   required_inputs: ["owner", "name"],
//   preferred_route: "cli",
//   fallback_routes: ["graphql"],
//   output_fields: ["id", "name", "nameWithOwner", "description", "isPrivate"]
// }
```

**Agent Prompt Guidance:**

> "Before executing a capability, call `explainCapability(capability_id)` to see
> required inputs and output fields. This prevents errors and reduces token waste."

### 3. `createExecuteTool(deps)`

Create a tool that executes capabilities with proper error handling and result
envelope parsing.

**Setup:**

```ts
import {
  createExecuteTool,
  createGithubClientFromToken,
  executeTask,
} from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

const tool = createExecuteTool({
  executeTask: (request) =>
    executeTask(request, { githubClient, githubToken: token }),
})
```

**Usage:**

```ts
const result = await tool.execute(
  "repo.view",
  { owner: "aryeko", name: "ghx" },
)

// result is a ResultEnvelope
if (result.ok) {
  console.log(result.data)
} else {
  console.error(result.error?.code)
}
```

## Result Envelope Handling

Every capability execution returns a stable envelope. Teach your agent how to
handle it:

### Success Case

```ts
if (result.ok) {
  // Use result.data for the actual output
  const repoName = result.data.nameWithOwner
  console.log(`Repository: ${repoName}`)
}
```

### Error Case

```ts
if (!result.ok) {
  const { code, message, retryable } = result.error!

  if (retryable) {
    // Safe to retry; exponential backoff recommended
    console.log("Retryable error, trying again...")
  } else {
    // Do not retry; show user
    console.error(`Error: ${message}`)
  }
}
```

### Metadata

```ts
// Access routing information
const route = result.meta.route_used // "cli" or "graphql"
const reason = result.meta.reason // "CARD_PREFERRED", "CLI_NOT_AVAILABLE", etc.

console.log(`Executed via ${route} (reason: ${reason})`)
```

## Integration Patterns

### Agent Tool Registration

In your agent framework (Claude Code, custom LLM, etc.), register the three
tools:

```ts
const tools = {
  ghx_list_capabilities: {
    description: "List all available GitHub capabilities",
    execute: () => listCapabilities(),
  },
  ghx_explain_capability: {
    description: "Explain a capability's inputs and outputs",
    execute: (args: { capability_id: string }) =>
      explainCapability(args.capability_id),
  },
  ghx_execute: {
    description: "Execute a GitHub capability",
    execute: (args: { capability_id: string; params: Record<string, unknown> }) =>
      tool.execute(args.capability_id, args.params),
  },
}
```

### Agent Loop with Retry Logic

```ts
async function executeCapabilityWithRetry(
  capabilityId: string,
  params: Record<string, unknown>,
  maxRetries: number = 2,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await tool.execute(capabilityId, params)

    if (result.ok) {
      return result.data
    }

    if (!result.error?.retryable) {
      throw new Error(`[${result.error?.code}] ${result.error?.message}`)
    }

    if (attempt < maxRetries) {
      console.log(
        `Attempt ${attempt} failed (${result.error?.code}), retrying...`,
      )
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }

  throw new Error(`Max retries exceeded for ${capabilityId}`)
}
```

### With Agent Context

```ts
async function executeWithContext(
  agentState: AgentState,
  capabilityId: string,
  params: Record<string, unknown>,
) {
  // Explain capability to agent
  const explanation = explainCapability(capabilityId)
  agentState.log(`Required inputs: ${explanation.required_inputs.join(", ")}`)

  // Execute
  const result = await tool.execute(capabilityId, params)

  // Log result
  agentState.log(`Route used: ${result.meta.route_used}`)

  return result
}
```

## Common Challenges

### "I don't know which capability to use"

**Solution:** Use `listCapabilities()` and `explainCapability()` to discover and
understand capabilities:

```ts
const all = listCapabilities()
const repos = all.filter((c) => c.capability_id.startsWith("repo."))
const explanation = explainCapability("repo.view")
```

### "I got a validation error"

**Solution:** Call `explainCapability()` before executing to see required
fields:

```ts
const { required_inputs } = explainCapability("issue.create")
// Ensure your params include all required_inputs
```

### "A capability failed; should I retry?"

**Solution:** Check `error.retryable`:

```ts
if (!result.ok && result.error?.retryable) {
  // Retry is safe
} else {
  // Do not retry; show user the error
}
```

### "The result has a lot of extra fields I don't need"

**Solution:** Use `explainCapability()` to see output fields and extract only
what you need:

```ts
const { output_fields } = explainCapability("repo.view")
const needed = result.data[output_fields[0]] // Extract first field
```

## Performance Tips

1. **Call `listCapabilities()` once** — Cache the result instead of calling
   repeatedly
2. **Use `explainCapability()` before loop** — Avoid repeated calls in loops
3. **Batch operations** — Combine multiple queries into a single capability call
   when possible
4. **Respect rate limits** — If you get `RATE_LIMIT`, back off for 60+ seconds
5. **Enable CLI caching** — ghx caches CLI environment checks for 30 seconds

## Environment Setup

Make sure your agent has access to:

- `GITHUB_TOKEN` or `GH_TOKEN` — GitHub authentication
- `gh` CLI installed (for CLI-routed capabilities)
- Node.js 22+

In Claude Code, set these in your system environment or `.env` file:

```bash
export GITHUB_TOKEN=ghp_...
```

---

See [Understanding the Result Envelope](result-envelope.md) for detailed
response parsing, and [Error Handling & Codes](error-handling.md) for debugging
errors.
