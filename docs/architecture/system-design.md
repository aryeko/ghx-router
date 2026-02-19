# System Design (v1)

`ghx` moves GitHub execution policy into deterministic runtime behavior.

## Goals

- stable capability contracts
- deterministic route planning and fallback
- normalized route-independent output
- benchmarkable reliability and efficiency

## Runtime Model

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#9C27B0', 'primaryTextColor': '#fff', 'primaryBorderColor': '#7B1FA2', 'lineColor': '#666', 'secondaryColor': '#CE93D8', 'tertiaryColor': '#E1BEE7'}}}%%
flowchart TB
  subgraph Agent["Agent Request 🤖"]
    A["Agent Interface Tools<br/>(execute, explain, list)"]
  end

  subgraph Planning["Planning 📋"]
    B["Operation Card Registry<br/>(schema validation)"]
  end

  subgraph Engine["Routing & Execution 🔀"]
    C["Execute Orchestration<br/>(retry, fallback)"]
    D["Preflight Checks<br/>(auth, capability limits)"]
  end

  subgraph Adapters["Adapters ⚙️"]
    E["CLI Adapter<br/>(gh command)"]
    F["GraphQL Adapter<br/>(GitHub API)"]
    G["REST Adapter<br/>(stub)"]
  end

  subgraph Output["Output Normalization 📦"]
    H["Result Normalizer"]
    I["ResultEnvelope<br/>{ok, data, error, meta}"]
  end

  subgraph Meta["Telemetry 📊"]
    J["Structured Events<br/>(route.plan, route.attempt, ...)"]
  end

  A --> B
  B --> C
  C --> D
  D --> E
  D --> F
  D --> G
  E --> H
  F --> H
  G --> H
  H --> I
  C --> J
```

## Result Envelope

Every capability returns:

- `ok`: boolean
- `data`: normalized payload on success
- `error`: normalized error on failure
- `meta`: `capability_id`, `route_used`, `reason`, plus optional trace/timing fields

## Route Planning

- capability cards define preferred and fallback routes
- preflight checks gate route eligibility
- execute applies bounded retries for retryable errors
- fallback proceeds in deterministic card order

## Current Scope

- Repository + issue reads: `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`
- Pull request reads: `pr.view`, `pr.list`, `pr.thread.list`, `pr.review.list`, `pr.diff.files`, `pr.diff.view`
- Pull request checks + mergeability: `pr.checks.list`, `pr.checks.failed`, `pr.merge.status`
- Pull request mutations: `pr.create`, `pr.update`, `pr.thread.reply`, `pr.thread.resolve`, `pr.thread.unresolve`, `pr.merge`, `pr.review.submit`, `pr.review.request`
- CI diagnostics/logs: `check_run.annotations.list`, `workflow.runs.list`, `workflow.job.logs.raw`, `workflow.job.logs.get`
- Route preferences are capability-specific and defined in cards (`preferred` + `fallbacks`), with REST still outside active routing for current capabilities

## Source References

- `packages/core/src/core/execute/execute.ts`
- `packages/core/src/core/registry/cards/*.yaml`
- `packages/core/src/core/contracts/envelope.ts`
- `packages/core/src/agent-interface/tools/`
