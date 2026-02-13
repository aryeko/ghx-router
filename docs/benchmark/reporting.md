# Benchmark Reporting

## Required Artifacts

- raw rows: `packages/benchmark/results/*.jsonl`
- machine summary: `packages/benchmark/reports/latest-summary.json`
- human summary: `packages/benchmark/reports/*.md`

## Required Summary Content

- scenario coverage and run counts
- median/p90 token and latency comparisons
- success and output-validity rates
- tool-call and retry trends
- regressions and gating outcome

## Release Gate Inputs

- `docs/benchmark/efficiency-criteria.md`
- `pnpm run benchmark:gate`
