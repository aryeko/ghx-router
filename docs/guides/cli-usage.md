# CLI Usage Guide

Use the ghx CLI to execute GitHub operations directly from the terminal or shell
scripts.

## Installation

Install ghx globally:

```bash
npm install -g @ghx-dev/core
```

Or run without installing:

```bash
npx @ghx-dev/core <command>
```

## Prerequisites

- Node.js 22+
- `gh` CLI installed and authenticated (`gh auth status`)
- `GITHUB_TOKEN` or `GH_TOKEN` environment variable (optional; `gh` auth handles
  it)

## Commands

### List All Capabilities

```bash
ghx capabilities list
```

Returns a JSON array of all 66 capabilities with descriptions:

```json
[
  {
    "capability_id": "repo.view",
    "description": "Get repository metadata"
  },
  {
    "capability_id": "issue.create",
    "description": "Create an issue"
  }
]
```

### Explain a Capability

```bash
ghx capabilities explain <capability_id>
```

Shows the input/output contract, preferred route, and fallback routes:

```bash
ghx capabilities explain repo.view
```

Output:

```json
{
  "capability_id": "repo.view",
  "purpose": "Get repository metadata",
  "required_inputs": ["owner", "name"],
  "preferred_route": "cli",
  "fallback_routes": ["graphql"],
  "output_fields": ["id", "name", "nameWithOwner", "description", "isPrivate"]
}
```

Use this before running a capability to understand what inputs and outputs you'll
get.

### Run a Capability

```bash
ghx run <capability_id> --input '<json>'
```

Execute a capability and get a result envelope.

**Example: View a repository**

```bash
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Response:

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

**Example: Create an issue**

```bash
ghx run issue.create --input '{
  "owner": "aryeko",
  "repo": "ghx",
  "title": "Add more tests",
  "body": "We need comprehensive test coverage"
}'
```

**Example: List pull requests**

```bash
ghx run pr.list --input '{
  "owner": "aryeko",
  "repo": "ghx",
  "state": "open",
  "limit": 10
}'
```

### Setup for Agents

```bash
ghx setup --scope project --yes
```

Installs the ghx skill for Claude Code and other coding agents. Creates
`.agents/skills/ghx/SKILL.md` with agent-friendly documentation.

See [Agent Integration](agent-integration.md) for details.

## Common Patterns

### Get structured output for scripts

All responses are JSON. Pipe to `jq` for extraction:

```bash
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}' | jq '.data.id'
```

### Check if a command succeeded

Test the `ok` field:

```bash
if ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}' | jq '.ok' | grep -q true; then
  echo "Success"
fi
```

### Handle errors

When `ok` is false, check the error code:

```bash
RESULT=$(ghx run repo.view --input '{"owner":"invalid","name":"repo"}')
if ! echo "$RESULT" | jq '.ok' | grep -q true; then
  ERROR_CODE=$(echo "$RESULT" | jq -r '.error.code')
  echo "Error: $ERROR_CODE"
fi
```

### Atomic chains

For mutations that must share a single HTTP round-trip, use `ghx chain`. All steps are
validated before any HTTP call is made, and the entire chain executes in at most 2 network
round-trips regardless of chain length.

**Inline JSON:**

```bash
ghx chain --steps '[
  {"task":"issue.labels.set","input":{"issueId":"I_kwDOOx...","labels":["bug"]}},
  {"task":"issue.assignees.set","input":{"issueId":"I_kwDOOx...","assignees":["octocat"]}}
]'
```

**Stdin variant:**

```bash
echo '[
  {"task":"issue.labels.set","input":{"issueId":"I_kwDOOx...","labels":["bug"]}},
  {"task":"issue.assignees.set","input":{"issueId":"I_kwDOOx...","assignees":["octocat"]}}
]' | ghx chain --steps -
```

Output:

```json
{
  "status": "success",
  "results": [
    {"task": "issue.labels.set", "ok": true, "data": {"id": "I_kwDOOx...", "labels": ["bug"]}},
    {"task": "issue.assignees.set", "ok": true, "data": {"id": "I_kwDOOx...", "assignees": ["octocat"]}}
  ],
  "meta": {"route_used": "graphql", "total": 2, "succeeded": 2, "failed": 0}
}
```

Exit code is `0` when `status` is `"success"` or `"partial"`, `1` when `"failed"`.

> **Note:** For independent read-only operations (queries), the shell `for` loop or
> `Promise.all()` pattern is still appropriate — atomicity is only needed for mutations.

```bash
# Parallel read-only queries (no atomicity needed)
for owner_repo in "aryeko/ghx" "owner2/repo2"; do
  owner=$(echo $owner_repo | cut -d/ -f1)
  repo=$(echo $owner_repo | cut -d/ -f2)
  ghx run repo.view --input "{\"owner\":\"$owner\",\"name\":\"$repo\"}"
done
```

## Environment Variables

- `GITHUB_TOKEN` — GitHub PAT or fine-grained token
- `GH_TOKEN` — Alternative to `GITHUB_TOKEN`
- `GITHUB_GRAPHQL_URL` — Override default GraphQL endpoint (rarely needed)
- `GH_HOST` — GitHub Enterprise host (derives GraphQL endpoint)

## Routing Behavior

By default, ghx chooses the best route (CLI or GraphQL) based on the capability
card:

- **CLI route** — Lightweight, good for simple operations; requires `gh` CLI
- **GraphQL route** — Powerful for complex queries; requires GITHUB_TOKEN

If the preferred route fails and a fallback is available, ghx tries the fallback
automatically. See [How Routing Works](routing-explained.md) for details.

## Exit Codes

- `0` — Command succeeded
- `1` — Error (invalid capability, parsing error, execution failure)

## Troubleshooting

**"gh CLI not found"**

Install the GitHub CLI: https://cli.github.com/

**"unauthorized"**

Check that `gh auth status` shows you as authenticated:

```bash
gh auth status
```

If not, authenticate:

```bash
gh auth login
```

**"capability not found"**

Run `ghx capabilities list` to see available capabilities. Capability IDs are
case-sensitive (e.g., `repo.view`, not `repoView`).

**"invalid input"**

Check that your JSON is valid and matches the required fields. Use
`ghx capabilities explain <id>` to see required inputs.

---

See [Understanding the Result Envelope](result-envelope.md) for details on the
response structure, and [Error Handling & Codes](error-handling.md) for
troubleshooting error responses.
