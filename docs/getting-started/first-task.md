# First Task Tutorial

Build a complete workflow using ghx: create an issue, add a label, and comment on it. By the end,
you'll understand how to compose capabilities and handle results.

## Scenario

We're going to automate part of a PR review workflow:

1. **Create** an issue to track a needed improvement
2. **Label** it so the team knows it's a documentation task
3. **Comment** with context

All three operations return the stable `{ ok, data, error, meta }` envelope.

## Before You Start

- ghx installed: `npm install @ghx-dev/core` or `npm install -g @ghx-dev/core`
- `gh` authenticated: `gh auth status` shows "Logged in"
- A test repository (or use an existing one you own)

## Part 1: Create an Issue

First, let's understand the `issue.create` capability:

```bash
npx ghx capabilities explain issue.create
```

You'll see the contract:

- **Input:** `owner`, `repo`, `title` (required); `body`, `labels`, `assignees` (optional)
- **Output:** Issue object with `id`, `number`, `title`, `body`, `url`, etc.

Now create an issue:

```bash
npx ghx run issue.create --input '{
  "owner": "YOUR_USERNAME",
  "repo": "YOUR_REPO",
  "title": "Improve documentation",
  "body": "Add more examples to the getting-started guide"
}'
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual values.

Expected output:

```json
{
  "ok": true,
  "data": {
    "id": "I_kwDOOx...",
    "number": 42,
    "title": "Improve documentation",
    "body": "Add more examples to the getting-started guide",
    "url": "https://github.com/YOUR_USERNAME/YOUR_REPO/issues/42",
    "createdAt": "2026-02-17T10:30:00Z"
  },
  "error": null,
  "meta": {
    "capability_id": "issue.create",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

**Key takeaway:** The `number` field (42 in this example) is what we use to reference this issue
in subsequent operations.

## Part 2: Add a Label to the Issue

Before we can label the issue, let's see what labels are available:

```bash
npx ghx run repo.labels.list --input '{
  "owner": "YOUR_USERNAME",
  "repo": "YOUR_REPO"
}'
```

This shows all labels in the repository. Find one like `docs`, `enhancement`, or `bug`.

Now add a label to our issue using the number from Part 1:

```bash
npx ghx run issue.labels.update --input '{
  "owner": "YOUR_USERNAME",
  "repo": "YOUR_REPO",
  "number": 42,
  "labels": ["docs"]
}'
```

Output:

```json
{
  "ok": true,
  "data": {
    "number": 42,
    "labels": ["docs"]
  },
  "error": null,
  "meta": {
    "capability_id": "issue.labels.update",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

## Part 3: Comment on the Issue

Add a comment to provide more context:

```bash
npx ghx run issue.comments.create --input '{
  "owner": "YOUR_USERNAME",
  "repo": "YOUR_REPO",
  "number": 42,
  "body": "Starting work on this. Will add TypeScript examples and a quick-start video."
}'
```

Output:

```json
{
  "ok": true,
  "data": {
    "id": "IC_kwDOOx...",
    "body": "Starting work on this. Will add TypeScript examples and a quick-start video.",
    "createdAt": "2026-02-17T10:31:00Z"
  },
  "error": null,
  "meta": {
    "capability_id": "issue.comments.create",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

## Part 4: Verify the Issue

Let's read back the issue to confirm everything worked:

```bash
npx ghx run issue.view --input '{
  "owner": "YOUR_USERNAME",
  "repo": "YOUR_REPO",
  "number": 42
}'
```

Output:

```json
{
  "ok": true,
  "data": {
    "id": "I_kwDOOx...",
    "number": 42,
    "title": "Improve documentation",
    "body": "Add more examples to the getting-started guide",
    "url": "https://github.com/YOUR_USERNAME/YOUR_REPO/issues/42",
    "labels": ["docs"],
    "createdAt": "2026-02-17T10:30:00Z"
  },
  "error": null,
  "meta": {
    "capability_id": "issue.view",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

Perfect! The label was added and the comment is recorded.

## Using ghx in Node.js Code

Instead of CLI commands, you can do all of this in code:

```ts
import { executeTask, createGithubClientFromToken } from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

// Helper to execute a capability and handle errors
async function runCapability(task: string, input: Record<string, unknown>) {
  const result = await executeTask(
    { task, input },
    { githubClient, githubToken: token },
  )

  if (!result.ok) {
    throw new Error(`${result.error?.code}: ${result.error?.message}`)
  }

  return result.data
}

async function main() {
  // Part 1: Create issue
  const issue = await runCapability("issue.create", {
    owner: "YOUR_USERNAME",
    repo: "YOUR_REPO",
    title: "Improve documentation",
    body: "Add more examples to the getting-started guide",
  })

  console.log(`Created issue #${issue.number}`)

  // Part 2: Add label
  await runCapability("issue.labels.update", {
    owner: "YOUR_USERNAME",
    repo: "YOUR_REPO",
    number: issue.number,
    labels: ["docs"],
  })

  console.log(`Added label "docs" to issue #${issue.number}`)

  // Part 3: Comment
  const comment = await runCapability("issue.comments.create", {
    owner: "YOUR_USERNAME",
    repo: "YOUR_REPO",
    number: issue.number,
    body: "Starting work on this. Will add TypeScript examples and a quick-start video.",
  })

  console.log(`Added comment: ${comment.id}`)

  // Part 4: Verify
  const verified = await runCapability("issue.view", {
    owner: "YOUR_USERNAME",
    repo: "YOUR_REPO",
    number: issue.number,
  })

  console.log(`Verified: labels = [${verified.labels.join(", ")}]`)
}

main().catch(console.error)
```

Run it:

```bash
GITHUB_TOKEN="your_token_here" npx ts-node script.ts
```

## Error Handling

What if something goes wrong? ghx returns detailed error info:

```bash
# Try to create an issue with missing required field
npx ghx run issue.create --input '{
  "owner": "YOUR_USERNAME",
  "repo": "YOUR_REPO"
  # Missing "title" — required!
}'
```

Output:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION",
    "message": "Input validation failed: missing required field 'title'",
    "retryable": false,
    "details": {
      "field": "title",
      "type": "required"
    }
  },
  "meta": {
    "capability_id": "issue.create",
    "route_used": null,
    "reason": "VALIDATION_FAILED"
  }
}
```

Error codes you might encounter:

| Code | Meaning | Retryable |
|------|---------|-----------|
| `VALIDATION` | Input doesn't match schema | No |
| `AUTH` | Authentication failed | No |
| `RATE_LIMIT` | API rate limit hit | Yes |
| `NOT_FOUND` | Repository/issue doesn't exist | No |
| `SERVER` | GitHub API server error | Yes |
| `NETWORK` | Network error | Yes |

In code, check the error:

```ts
const result = await executeTask(request, { githubClient, githubToken: token })

if (!result.ok) {
  if (result.error?.code === "RATE_LIMIT") {
    console.log("Rate limited. Waiting 60 seconds...")
    await new Promise((resolve) => setTimeout(resolve, 60000))
    // Retry
  } else if (result.error?.code === "VALIDATION") {
    console.error("Invalid input:", result.error.details)
  } else {
    console.error("Failed:", result.error?.message)
  }
}
```

## Next Steps

### Explore More Capabilities

List all available operations:

```bash
npx ghx capabilities list
```

See what you can do with PRs:

```bash
npx ghx capabilities explain pr.merge
npx ghx capabilities explain pr.review.submit
```

Or workflows:

```bash
npx ghx capabilities explain workflow.dispatch.run
npx ghx capabilities explain workflow.job.logs.get
```

### Build a Real Workflow

Combine multiple capabilities to solve a problem:

- **Auto-close stale issues** — Query issues, check last activity, close if old
- **Label PRs automatically** — Read PR title/description, apply labels
- **Sync issues to projects** — Create issue, add to project board
- **Post release summaries** — List merged PRs, create release notes, post to discussions

### Use in Your Agent

If you're building a coding agent (Claude, Cursor, OpenCode, etc.):

1. Install ghx skill: `npx ghx setup --scope project --yes`
2. The agent will automatically discover and use ghx capabilities
3. See [Agent Setup Guide](setup-for-agents.md) for details

### Learn the Architecture

Curious how ghx works? Read [How ghx Works](how-it-works.md) to understand:

- Why there are three execution routes (CLI, GraphQL, REST)
- How routing decisions are made
- What makes the result envelope stable
- How agents discover capabilities

## Troubleshooting This Tutorial

### "Repository not found"

Make sure you use a repository you have access to and that exists on GitHub.

### "VALIDATION: missing required field"

Check the capability contract:

```bash
npx ghx capabilities explain issue.create
```

See which fields are required and provide them.

### "AUTH: Invalid GitHub token"

Your token might be invalid or expired. Create a new one at
[github.com/settings/tokens](https://github.com/settings/tokens) and set it:

```bash
export GITHUB_TOKEN="your_new_token_here"
```

### "RATE_LIMIT"

GitHub's API has rate limits. Wait a few minutes and try again. If this happens in production,
implement exponential backoff (see error handling section above).

## What You've Learned

You now know:

- How to discover capabilities with `capabilities list` and `capabilities explain`
- How to run operations with `run` and understand the result envelope
- How to compose multiple capabilities into a workflow
- How to handle errors and retry appropriately
- How to use ghx both from the CLI and in Node.js code

You're ready to:

1. Build more complex workflows
2. Integrate ghx into automation scripts
3. Set up ghx for coding agents
4. Explore the full 69-capability API

## Next Resources

- **[Agent Setup Guide](setup-for-agents.md)** — Make agents auto-discover ghx
- **[How ghx Works](how-it-works.md)** — Deep dive into architecture
- **[Operation Card Registry](../architecture/operation-cards.md)** — Full API reference
- **[Routing Engine](../architecture/routing-engine.md)** — Understand execution paths

---

**Questions?** Open an issue on [GitHub](https://github.com/aryeko/ghx/issues) with your code
and error message.
