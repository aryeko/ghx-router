# Benchmark Reporting

## Required Artifacts

- raw rows: `packages/benchmark/results/*.jsonl`
- machine summary: `packages/benchmark/reports/latest-summary.json`
- human summary: `packages/benchmark/reports/*.md`

## Required Summary Content

- scenario coverage and run counts
- median token and latency comparisons (p90 optional)
- success and output-validity rates
- runner-failure and timeout/stall rates
- tool-call and retry trends
- v2 gate outcome with profile (`pr_fast` or `nightly_full`)
- stable-sample efficiency coverage and reductions
- legacy v1 gate outcome (compatibility visibility)

## Release Gate Inputs

- `docs/benchmark/efficiency-criteria.md`
- `pnpm run benchmark:gate`

## Gate Profile Selection

`report` supports profile selection:

- `--gate-profile pr_fast` (default)
- `--gate-profile nightly_full`

`--gate` evaluates gate v2 for the selected profile.
