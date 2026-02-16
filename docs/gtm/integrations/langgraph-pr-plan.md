# LangGraph PR Plan

## Maintainer Fit Rationale
LangGraph users build production agent workflows where predictable tool interfaces and repeatable GitHub execution flows are directly relevant.

## Likely Files and Paths
1. `docs/` tutorial or integrations page for tooling examples.
2. `examples/` workflow sample showing GitHub task execution.
3. Optional README integration callout.

## Minimal Example
Add a compact workflow node that invokes `ghx` capability execution for repo/PR status retrieval and returns normalized output.

## PR Title Template
`docs(examples): add ghx GitHub workflow example for agent graph execution`

## PR Body Template
1. Problem: agent workflows repeatedly re-discover GitHub execution details.
2. Change: add minimal `ghx` integration example with run instructions.
3. Validation: include expected output shape and quickstart commands.
4. Scope: docs/example only, no core behavior change.

## Benchmark Placeholder Note
Numeric claims remain placeholders until snapshot sign-off:
`<TOKENS_DELTA_PCT>`, `<LATENCY_DELTA_PCT>`, `<TOOL_CALLS_DELTA_PCT>`, `<SUCCESS_RATE>`, `<N_RUNS>`, `<MODEL_ID>`, `<BENCH_DATE>`.

## Rejection Fallback
Publish the same example as a standalone `ghx` docs recipe and reference LangGraph-compatible usage patterns.
