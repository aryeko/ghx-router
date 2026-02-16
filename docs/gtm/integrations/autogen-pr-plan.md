# AutoGen PR Plan

## Maintainer Fit Rationale
AutoGen users often orchestrate multi-step tooling tasks where stable GitHub execution interfaces reduce brittleness and improve repeatability.

## Likely Files and Paths
1. `python/packages/autogen-ext/` or related extension docs where tool adapters are demonstrated.
2. `docs/` examples for external tool execution.
3. Optional sample notebooks or quickstart guides.

## Minimal Example
Provide a minimal AutoGen tool wrapper that executes two `ghx` commands for capability discovery and one repo task.

## PR Title Template
`docs(examples): add ghx-backed GitHub execution tool example`

## PR Body Template
1. Problem statement and audience.
2. Minimal integration snippet.
3. Local run steps and expected output shape.
4. Notes on claim placeholders and benchmark gating.

## Benchmark Placeholder Note
No hard numbers in PR until benchmark snapshot sign-off. Use placeholder tokens only.

## Rejection Fallback
Ship the adapter and walkthrough in `ghx` docs with an AutoGen-focused section and reusable snippet.
