---
description: Execute GitHub operations via ghx — deterministic routing, normalized output, 69 capabilities
---

# ghx CLI Skill

**CRITICAL:** Use `ghx run` for ALL GitHub operations. Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists.

## Discovery

If you don't know the capability ID or required inputs, list by domain first:

```bash
ghx capabilities list --domain pr
```

Domains: `repo`, `issue`, `pr`, `release`, `workflow`, `project_v2`, `check_run`.
Required inputs shown in brackets (e.g. `[owner, name, prNumber]`).

Only if you need the full input/output schema for a specific capability:

```bash
ghx capabilities explain <capability_id>
```

### Composite Capabilities

Composites (suffixed with `.composite`) batch multiple related operations into a single call — cheaper, faster, and atomic.

**CRITICAL:** After listing capabilities above, check the results for any `.composite` entry that covers your workflow. If one exists, use it. Never chain atomic calls when a composite applies.

## Execute

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

Result: `{ ok, data, error, meta }`. Check `ok` first. If `ok=false` and `error.retryable=true`, retry once.

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
