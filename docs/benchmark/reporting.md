# Benchmark Reporting

Defines report formats and release gate criteria.

## Required Artifacts

- `packages/benchmark/results/*.jsonl` (raw runs)
- `packages/benchmark/reports/*.md` (human summary)
- `packages/benchmark/reports/latest-summary.json` (machine summary)

## Required Summary Sections

- Scenario count and coverage
- Median and P90 latency/token comparisons
- Success-rate and output-validity comparisons
- Regressions and unresolved gaps

## v1 Validation Thresholds

- >=25% median token reduction vs `agent_direct`
- >=20% median latency reduction on common tasks
- >=30% tool-call reduction
- Non-inferior success rate
- >=99% output validity

Threshold source:

- `docs/benchmark/efficiency-criteria.md`
