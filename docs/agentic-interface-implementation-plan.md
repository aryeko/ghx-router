# Agentic Interface Implementation Plan

**Status:** Completed  
**Source:** `docs/docs_design_agentic-interface.md`  
**Scope:** Full v1 implementation of the design doc, including contracts, routing, adapters, agent interface tools, benchmarks, and rollout safeguards.

---

## Completion Summary

Implemented deliverables now shipped in code:

- v1 `ResultEnvelope` contract (`ok/data/error/meta`) with normalized taxonomy.
- operation-card registry and card-derived capability routing.
- execute orchestration with required-input checks, retries, fallback, and attempt trace support.
- typed GraphQL capability adapter and structured CLI capability adapter.
- agent-interface tools (`execute`, `explain`, `list_capabilities`) and stable main-skill prompt text.
- benchmark envelope/assertion updates, attempt metric extraction, and scenario schema expansion.
- telemetry metric logging with sensitive-context redaction.

---

## Planning Principles

- Implement in incremental phases with clear entry/exit criteria.
- Keep behavior deterministic and inspectable at every layer.
- Validate contracts at boundaries (input, output, routing, errors).
- Prefer additive changes and compatibility bridges where migration risk exists.
- Gate progress with tests and benchmark evidence, not assumptions.

---

## Phase 0 - Baseline and Migration Guardrails

### Goal
Establish the current baseline and lock expected behavior before introducing new contracts.

### Requirements
- Capture current execution behavior for thin-slice capabilities (`repo.view`, `issue.view`, `issue.list`, `pr.view`, `pr.list`).
- Record baseline benchmark metrics (tokens, tool calls, pass rate).
- Identify all consumers of current envelope fields (for example `success` vs future `ok`).
- Add migration notes documenting temporary compatibility behavior.

### Verification
- Baseline benchmark run artifacts committed or stored in CI artifacts.
- Unit/integration tests cover current success/error response shape.
- A migration matrix exists listing all call sites impacted by envelope changes.

---

## Phase 1 - Core Contracts (Envelope, Errors, Operation Cards)

### Goal
Define and enforce the stable runtime contract shared across router, adapters, and tools.

### Requirements
- Implement `ResultEnvelope` v1 with:
  - `ok`, `data`, `error`, `meta`
  - normalized `ErrorCode` taxonomy
  - `retryable` semantics
  - route and attempt metadata
- Implement `OperationCard` and `SuitabilityRule` types.
- Add JSON Schema validation for operation cards at load time.
- Add route reason enum/typing aligned with the design doc.
- Provide backward compatibility strategy where old envelope consumers still exist.

### Verification
- Contract tests validate envelope and error shape with strict type assertions.
- Card schema tests include valid and invalid fixtures.
- CI fails if any card does not validate against schema.
- No adapter can return raw output without normalization.

---

## Phase 2 - Registry and Card-Driven Routing

### Goal
Move capability definition and route policy into runtime-loaded operation cards.

### Requirements
- Build card registry loader and index by `capability_id`.
- Add initial cards for:
  - `repo.view`
  - `issue.view`
  - `issue.list`
  - `pr.view`
  - `pr.list`
- Implement deterministic route planning order:
  1. card preferred route
  2. card fallback routes
  3. suitability constraints
  4. preflight/environment constraints
- Ensure planned route decisions are explainable through machine-readable route reasons.

### Verification
- Routing unit tests prove deterministic route ordering and pruning.
- Preflight failure on preferred route results in fallback selection.
- Route planning traces match expected reason codes.
- `list_capabilities` can read capabilities from registry source of truth.

---

## Phase 3 - Execute Orchestration (Validation, Retry, Fallback)

### Goal
Implement the canonical `execute(capability_id, params, options?)` flow end to end.

### Requirements
- Validate params against card `input_schema` before adapter execution.
- Attempt route sequence from router planner.
- Apply retry policy for retryable errors (`NETWORK`, `RATE_LIMIT`, selected `SERVER`).
- Apply fallback when:
  - preflight fails,
  - adapter limitation is non-retryable,
  - retry budget is exhausted.
- Return one normalized envelope with optional trace metadata.
- Keep raw API payloads out of default responses.

### Verification
- Integration tests for:
  - preferred route success,
  - retry then success,
  - preferred fail then fallback success,
  - terminal failure after all routes.
- Validation failures return `VALIDATION` without adapter calls.
- Trace mode includes attempts and route decisions without secret leakage.
- Retry behavior is deterministic and bounded.

---

## Phase 4 - Typed GraphQL Adapter Completion

### Goal
Deliver robust typed GraphQL execution for v1 capabilities without schema fetching at runtime.

### Requirements
- Pin GraphQL schema in repo and maintain codegen pipeline.
- Ensure each operation card references valid `operationName` and `documentPath`.
- Map card input to GraphQL variables deterministically.
- Keep GraphQL field selection minimal and aligned to normalized output schema.
- Normalize GraphQL errors into shared error taxonomy.

### Verification
- `gql:check` passes (no codegen drift).
- GraphQL adapter tests validate mapping, error normalization, and output shape.
- For each GraphQL-backed capability, output validates against `output_schema`.
- No GraphQL introspection or schema pull occurs during normal operation.

---

## Phase 5 - Structured gh CLI Adapter Completion

### Goal
Implement safe, structured CLI wrappers as first-class fallback or preferred routes.

### Requirements
- Implement per-capability CLI wrappers using argument arrays (`spawn`), not shell templates.
- Prefer `gh ... --json` for structured output.
- Use short internal `--jq` only when required.
- Validate CLI preflight (`gh` present, authenticated, optional scopes).
- Normalize CLI outputs/errors into envelope contract.

### Verification
- CLI adapter tests cover happy path, auth failures, unsupported fields, and parse errors.
- Security checks confirm no shell interpolation paths exist.
- Preflight failures return route-skip metadata and trigger fallback logic.
- CLI outputs conform to card `output_schema`.

---

## Phase 6 - Agent Interface Surface (`execute`, `explain`, `list_capabilities`)

### Goal
Expose a minimal, stable agent-facing tool surface with concise operational guidance.

### Requirements
- Implement tool handlers:
  - `execute`
  - `explain` (compact card summary)
  - `list_capabilities` (optional but supported)
- Add stable main-skill text enforcing:
  - never fetch schema
  - never run `gh help`
  - use `execute` as canonical path
  - retry policy interpretation from envelope
- Ensure explain payload remains compact and useful for missing parameter discovery.

### Verification
- Tool contract tests validate request/response types and failure behavior.
- Explain output remains within compact token budget target.
- Agent integration tests show successful execution without external docs/schema fetch.
- Capability discovery output matches registry IDs and descriptions.

---

## Phase 7 - Benchmarks and CI Enforcement

### Goal
Prove the design goals with measurable reliability and efficiency gates.

### Requirements
- Update benchmark scenarios for new envelope and route metadata.
- Add validators for:
  - output schema conformance
  - error code correctness
  - pagination behavior
  - route attempt visibility (trace mode)
- Enforce CI gates for:
  - verify/typecheck/lint/tests
  - GraphQL drift checks
  - benchmark pass thresholds
- Record baseline vs post-implementation token/tool-call deltas.

### Verification
- Benchmark suite passes with target reliability.
- Report includes:
  - pass rate
  - median and p95 tool calls
  - token reduction vs baseline
- CI blocks merge on shape drift, benchmark regression, or contract failures.

---

## Phase 8 - Security, Observability, and Production Readiness

### Goal
Harden runtime behavior and complete rollout safeguards for safe expansion.

### Requirements
- Redact sensitive fields in all errors and traces.
- Ensure tokens/headers are never returned to the agent output surface.
- Emit structured telemetry for route selection, retries, fallbacks, and durations.
- Define rollout mode:
  - v1 thin-slice capabilities enabled,
  - progressive expansion by new cards/capabilities.
- Document operational runbooks for common failure classes.

### Verification
- Security tests confirm no secrets in envelope, logs, or traces.
- Telemetry dashboards/logs show route and retry observability.
- Dry-run rollout checklist completed for all v1 capabilities.
- Expansion playbook validated by adding one new capability via card + adapters.

---

## Cross-Phase Global Exit Criteria

Implementation is complete when all conditions are true:

- `execute` is the canonical path for supported GitHub capabilities.
- All v1 operation cards validate and execute through deterministic routing.
- Adapters return only normalized outputs/errors under shared taxonomy.
- Agent-facing tools (`execute`, `explain`, optional `list_capabilities`) are stable.
- Benchmark targets are met or explicitly waived with documented rationale:
  - token reduction target,
  - reliability target,
  - bounded tool-call behavior.
- CI enforces contract, schema, and benchmark correctness.

---

## Recommended Verification Command Set

Use this command set as a release gate for each milestone:

```bash
pnpm run verify
pnpm --filter @ghx-router/core run gql:check
pnpm run benchmark:check
pnpm run benchmark:run
pnpm run benchmark:report
pnpm run benchmark:gate
```

If any command fails, halt rollout progression until the failure is resolved and re-verified.
