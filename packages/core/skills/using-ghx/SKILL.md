---
description: Execute GitHub operations via ghx — deterministic routing, normalized output, 69 capabilities
---

# ghx CLI Skill

**CRITICAL:** Use `ghx run` for ALL GitHub operations. Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists.

## Execute

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

Result: `{ ok, data, error, meta }`. Check `ok` first. If `ok=false` and `error.retryable=true`, retry once.

## Discovery (only when needed)

If you don't know the capability ID or required inputs, list by domain:

```bash
ghx capabilities list --domain pr
```

Domains: `repo`, `issue`, `pr`, `release`, `workflow`, `project_v2`, `check_run`.
Required inputs shown in brackets (e.g. `[owner, name, prNumber]`).

Use `ghx capabilities explain <capability_id>` to see full input/output schema.

## Composite Capabilities

When a workflow involves multiple operations on the same resource,
prefer composite capabilities (suffixed with `.composite`) over
sequential atomic calls. Check `ghx capabilities list` for available
composites — their descriptions explain what they combine.

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
