---
description: Execute GitHub operations via ghx — deterministic routing, normalized output, 70 capabilities
---

# ghx CLI Skill

**CRITICAL:** Use `ghx run` for ALL GitHub operations. Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists.

## Discovery

If you don't know the capability ID or required inputs, list by domain first:

```bash
ghx capabilities list --domain pr
```

Domains: `repo`, `issue`, `pr`, `release`, `workflow`, `project_v2`.
Required inputs shown in brackets (e.g. `[owner, name, prNumber]`).

Only if you need the full input/output schema for a specific capability:

```bash
ghx capabilities explain <capability_id>
```

## Execute

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

Result: `{ ok, data, error, meta }`. Check `ok` first. If `ok=false` and `error.retryable=true`, retry once.

## Chain

Use `ghx chain` when two or more mutations must succeed together. It batches steps into as few GraphQL round-trips as possible (typically one; capabilities that require a node-ID lookup add a single preflight query) — avoiding partial state from sequential `ghx run` calls.

```bash
ghx chain --steps '[
  {"task":"issue.close","input":{"issueId":"I_abc"}},
  {"task":"issue.comments.create","input":{"owner":"o","name":"r","issueNumber":1,"body":"Closed."}}
]'
```

**stdin variant:**

```bash
ghx chain --steps - <<'EOF'
[{"task":"...","input":{...}},{"task":"...","input":{...}}]
EOF
```

**Result:** `{ status, results[], meta }`. Check `status` first (`"success"` | `"partial"` | `"failed"`). Each `results[i]` has `{ task, ok, data | error }`.

**Chainable capabilities:** any capability with a `graphql:` route (i.e. those that accept node IDs or perform internal lookups — labels, assignees, milestones, relations, reviews, comments). Capabilities with only a `cli:` route cannot be chained.

**Limitation:** Steps run independently — outputs from one step cannot be referenced as inputs to another step in the same chain.

**Example — close an issue and leave a closing comment atomically:**

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"issue.close","input":{"issueId":"I_abc123"}},
  {"task":"issue.comments.create","input":{"owner":"octocat","name":"hello-world","issueNumber":42,"body":"Closed — see linked PR."}}
]
EOF
```

## Examples

```bash
ghx run repo.view --input - <<'EOF'
{"owner":"octocat","name":"hello-world"}
EOF

ghx run issue.create --input - <<'EOF'
{"owner":"octocat","name":"hello-world","title":"Bug report","body":"Steps to reproduce"}
EOF
```

**CRITICAL:** Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists. Always try `ghx run <capability_id>` first.
