# ghx

<p align="center">
  <img src="assets/branding/social/ghx-social-dark-1280x640.png" alt="ghx social preview" width="480">
</p>

> GitHub execution router for AI agents.
> One typed capability interface over `gh` CLI + GraphQL.

[![CI (main)](https://github.com/aryeko/ghx/actions/workflows/ci-main.yml/badge.svg)](https://github.com/aryeko/ghx/actions/workflows/ci-main.yml)
[![codecov](https://codecov.io/gh/aryeko/ghx/graph/badge.svg?token=KBIGR138V7)](https://codecov.io/gh/aryeko/ghx)
[![npm version](https://img.shields.io/npm/v/%40ghx-dev%2Fcore)](https://www.npmjs.com/package/@ghx-dev/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`ghx` helps agents execute GitHub tasks without re-discovering API surfaces on every run. Agents call stable capabilities like `repo.view` or `pr.merge`; ghx handles route choice, retries, fallbacks, and normalized output.

## The Problem

Agents instructed to "use `gh` CLI" for GitHub operations waste significant tokens on research, trial-and-error, and output parsing:

- **Array parameter syntax is fragile.** Submitting a PR review with inline comments via `gh api` requires `comments[0][path]`, `comments[][body]`, or heredoc piping. Agents try 3-15 syntaxes before one works.
- **API surface re-discovery every session.** Each new session, the agent figures out which `gh` subcommands exist, what `--json` fields are available, and how to format GraphQL queries from scratch.
- **Output shapes vary by endpoint.** REST, GraphQL, and `gh` CLI each return different structures. The agent spends tokens parsing and normalizing before it can reason about results.

> MCP mode benchmark coming soon.

## Before / After

**WITHOUT ghx** -- agent submitting a PR review with inline comments (15 tool calls, 126s):

```bash
gh pr view 42 --repo acme/repo                          # read PR
gh pr diff 42 --repo acme/repo                          # read diff
gh api POST reviews -f event=REQUEST_CHANGES \           # attempt 1: 422 error
  -f 'comments[0][path]=src/stats.ts' ...
noglob gh api POST reviews ...                           # attempt 2: 422 error
python3 -c "import json; ..." | gh api --input -         # attempt 3: no inline comments
gh api POST reviews/comments -f path=src/stats.ts ...    # attempt 4-6: individual comments
gh api POST reviews -f event=REQUEST_CHANGES             # attempt 7: submit event
gh pr view 42 --json reviews                             # verify
```

**WITH ghx** -- same task (2 tool calls, 26s):

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"pr.diff.view","input":{"owner":"acme","name":"repo","prNumber":42}},
  {"task":"pr.view","input":{"owner":"acme","name":"repo","prNumber":42}}
]
EOF
ghx run pr.reviews.submit --input - <<'EOF'
{
  "owner": "acme", "name": "repo", "prNumber": 42,
  "event": "REQUEST_CHANGES",
  "body": "Found blocking issues.",
  "comments": [
    {"path": "src/stats.ts", "line": 4, "body": "Empty array guard missing."},
    {"path": "src/stats.ts", "line": 8, "body": "Missing await on fetch."},
    {"path": "src/stats.ts", "line": 12, "body": "Hardcoded credential."}
  ]
}
EOF
```

## Benchmarked Performance

Tested across 40 runs (4 scenarios, 5 iterations each) with `gpt-5.3-codex`. Both modes achieved 100% success rate.

| Scenario | Tool calls | Active tokens | Latency |
| --- | --- | --- | --- |
| PR review with inline comments | **-55%** | **-88%** | **-57%** |
| Issue triage (labels + comment) | **-47%** | neutral | **-1%** |
| PR thread resolution (7 threads) | **-29%** | **-41%** | **-26%** |
| CI diagnosis and rerun | **-22%** | **-78%** | **-20%** |

Full methodology and per-iteration data: [Codex 5.3 Benchmark Report](reports/codex-5.3-benchmark/README.md)

## 30-Second Quick Start

Requirements: Node.js `22+`, `gh` CLI authenticated, `GITHUB_TOKEN` or `GH_TOKEN` in env.

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core capabilities explain repo.view
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Or install globally:

```bash
npm i -g @ghx-dev/core
ghx capabilities list
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Agent onboarding (Claude Code skill):

```bash
npx @ghx-dev/core setup --scope project --yes
npx @ghx-dev/core setup --scope project --verify
```

## Chain: Batch Operations

`ghx chain` batches multiple operations into a single tool call. One command, batched execution, three operations:

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"issue.labels.remove","input":{"owner":"acme","name":"repo","issueNumber":42,"labels":["triage","feature-request"]}},
  {"task":"issue.labels.add","input":{"owner":"acme","name":"repo","issueNumber":42,"labels":["enhancement"]}},
  {"task":"issue.comments.create","input":{"owner":"acme","name":"repo","issueNumber":42,"body":"Triaged -- tracking as enhancement."}}
]
EOF
```

Agents use chain to collapse multi-step workflows (label swap + comment, bulk thread resolve + reply, etc.) into a single tool call instead of sequential shell commands.

## Example Output

```json
{
  "ok": true,
  "data": {
    "id": "...",
    "name": "ghx",
    "nameWithOwner": "aryeko/ghx"
  },
  "error": null,
  "meta": {
    "capability_id": "repo.view",
    "route_used": "cli",
    "reason": "CARD_PREFERRED"
  }
}
```

## Golden Workflow: CI Diagnosis

Diagnose a failing CI run, read logs, rerun, and merge:

```bash
ghx run workflow.run.view --input '{"owner":"acme","name":"repo","runId":123456}'
ghx run workflow.job.logs.view --input '{"owner":"acme","name":"repo","jobId":789012}'
ghx run workflow.run.rerun.failed --input '{"owner":"acme","name":"repo","runId":123456}'
ghx run pr.checks.list --input '{"owner":"acme","name":"repo","prNumber":14}'
ghx run pr.merge --input '{"owner":"acme","name":"repo","prNumber":14,"method":"squash"}'
```

## Why Not Direct `gh` + GraphQL Calls?

| Concern | Direct Calls | `ghx` |
| --- | --- | --- |
| Route selection | Manual per operation | Deterministic policy per capability |
| Output shape | Varies by endpoint/tool | Stable `{ ok, data, error, meta }` envelope |
| Validation | Caller-owned | Runtime schema validation from operation cards |
| Retries/fallbacks | Caller-owned | Built-in orchestration |
| Capability discovery | Ad-hoc docs lookup | `capabilities list` and `capabilities explain` |

## 70 Capabilities

| Domain | Count | Examples |
| --- | --- | --- |
| Repository | 3 | `repo.view`, `repo.labels.list` |
| Issues | 23 | create/update/close, labels, assignees, milestones, relations |
| Pull Requests | 21 | diff, threads, reviews, checks, merge, branch update |
| Workflows and CI | 11 | runs, jobs, logs, dispatch, rerun, cancel, artifacts |
| Releases | 5 | view, list, create, update, publish |
| Projects v2 | 7 | items, fields, add/remove issues |

Full list: `ghx capabilities list` or [operation card registry](https://github.com/aryeko/ghx/tree/main/packages/core/src/core/registry/cards).

## Security and Permissions

- Use least-privilege tokens and only grant scopes needed for the capabilities you execute.
- For fast local evaluation, a classic PAT with `repo` scope is the simplest path.
- For production agents, prefer fine-grained tokens with read permissions first (`Metadata`, `Contents`, `Pull requests`, `Issues`, `Actions`, `Projects`) and add write permissions only where required.
- `ghx` reads `GITHUB_TOKEN` or `GH_TOKEN` from environment.

## Packages

- `@ghx-dev/core` (`packages/core`) - public npm package, CLI + execution engine
- `@ghx-dev/benchmark` (`packages/benchmark`) - private/internal benchmark harness for maintainers

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

- **[Getting Started](docs/getting-started/README.md)** -- Installation, first task, agent setup
- **[Capabilities Reference](docs/capabilities/README.md)** -- All 70 capabilities by domain
- **[Guides](docs/guides/README.md)** -- CLI usage, library API, agent integration, error handling
- **[Architecture](docs/architecture/README.md)** -- System design, routing engine, adapters
- **[Benchmark](docs/benchmark/README.md)** -- Methodology, running benchmarks, scenario authoring
- **[Contributing](docs/contributing/README.md)** -- Development setup, testing, CI, publishing
- Branding assets: `assets/branding/README.md`

## Roadmap

Current roadmap priorities and capability batches are tracked in `ROADMAP.md`.

## Contributing

See `CONTRIBUTING.md` for local setup, test commands, and PR expectations.

Tooling notes for local development:

- `gh` CLI is required for CLI-backed execution paths (`gh auth status`).
- `opencode` CLI is only required if you run E2E suites locally (`pnpm run test:e2e`); CI installs it via `curl -fsSL https://opencode.ai/install | bash`.

```bash
git clone https://github.com/aryeko/ghx.git && cd ghx
./scripts/setup-dev-env.sh
pnpm install
pnpm run build
pnpm run ci
```

## License

MIT © Arye Kogan
