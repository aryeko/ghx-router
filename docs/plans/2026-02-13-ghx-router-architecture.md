# ghx-router Architecture (v1)

## Problem Statement

Agents can complete GitHub tasks today with `gh`, `gh api`, or MCP-backed tools, but they often spend extra context and time deciding which interface to use and how to shape outputs. This creates repeated docs/schema lookups, inconsistent execution paths, and avoidable retries.

`ghx-router` moves that decision logic from prompt-time reasoning into a deterministic runtime.

## Design Goals

- CLI-first execution with explicit API fallbacks.
- Stable task contracts that avoid runtime doc-fetching.
- Deterministic route selection (`cli` | `rest` | `graphql`).
- Typed and normalized output for every task.
- Extensible architecture for non-Claude runtimes.

## System Components

1. Task Contract Layer
- Defines each task as a typed input/output contract.
- Example task IDs: `pr.list`, `pr.create`, `issue.status`, `project.items.list`.
- Validates input at runtime (fail fast, structured errors).

2. Policy + Routing Engine
- Uses static rules and tie-break order from README.
- Returns route decision with reason code (`coverage_gap`, `efficiency_gain`, `output_shape_requirement`).
- Prevents ad hoc route changes inside agent prompts.

3. Execution Adapters
- CLI Adapter: wraps `gh` commands and `--json` output.
- REST Adapter: wraps `gh api` for uncovered endpoints.
- GraphQL Adapter: uses generated typed client for deep relational queries.

4. Normalization Layer
- Converts all adapter outputs into a single envelope:
  - `success`
  - `data`
  - `error`
  - `meta` (`source`, pagination, rate-limit hints, timings)

5. Capability Registry
- Local metadata catalog: supported tasks, required scopes, default route, fallback routes.
- Versioned with the repo to avoid runtime documentation lookups.

6. Telemetry + Benchmark Hooks
- Captures per-invocation metrics (latency, retries, route chosen, call count, payload size).
- Feeds measurement harness for efficiency claims.

## Request Flow

1. Agent invokes `ghx run <task-id> --input <json>`.
2. Contract layer validates input.
3. Router chooses route and records rationale.
4. Adapter executes (`gh`, REST, or GraphQL).
5. Normalizer emits stable output envelope.
6. Telemetry logs execution metrics.

## Error Handling Strategy

- All failures use structured error objects (`code`, `message`, `details`, `retryable`).
- Auth and scope failures are detected in preflight and surfaced with concrete remediation.
- Pagination and transient network errors are retried with bounded backoff.
- Adapter-specific errors are mapped into common error codes.

## Security and Safety

- No token handling in logs.
- No hardcoded credentials.
- Route policies are read-only config at runtime in v1.
- All external calls go through audited adapters.

## v1 Scope

- Implement top 8-12 high-frequency task contracts.
- Route coverage focused on PR, issue, and repository operations.
- GraphQL limited to tasks where it clearly reduces request count.
- Benchmark harness included from day one.

## Out of Scope (v1)

- Full MCP server.
- Dynamic policy learning at runtime.
- Full parity with all `gh` subcommands.
