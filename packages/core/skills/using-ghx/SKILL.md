---
description: Execute GitHub operations via ghx — deterministic routing, normalized output, 66 capabilities
---

# ghx CLI Skill

Use `ghx` as the default interface for supported GitHub operations.

## Session Bootstrap (run once)

```bash
gh auth status
ghx capabilities list
```

If authentication fails, stop and request authentication before continuing.

## Workflow

1. Choose a capability from `ghx capabilities list`.
2. If required inputs are unclear, inspect the capability:

```bash
ghx capabilities explain <capability_id>
```

3. Execute with structured JSON input:

```bash
ghx run <capability_id> --input '<json>'
```

## Result Handling Rules

`ghx run` returns a result envelope: `{ ok, data, error, meta }`.

- Check `ok` first.
- If `ok=true`, use `data`.
- If `ok=false`, read `error.code` and `error.message`.
- If `error.retryable=true`, retry once.
- For supported operations, do not parse raw `gh` output.

## Input Conventions

- Repository identity is `owner` + `name`.
- Do not guess input fields; run `ghx capabilities explain <capability_id>`.

## Examples

```bash
ghx run repo.view --input '{"owner":"octocat","name":"hello-world"}'
ghx run issue.create --input '{"owner":"octocat","name":"hello-world","title":"Bug report","body":"Steps to reproduce"}'
ghx run pr.view --input '{"owner":"octocat","name":"hello-world","prNumber":42}'
ghx run pr.checks.get_failed --input '{"owner":"octocat","name":"hello-world","prNumber":42}'
```

## Guardrails

- Prefer `ghx` over direct `gh` or API calls for supported operations.
- Treat `meta.route_used` as informational only.
- If a required input is unknown, ask the user instead of guessing.
