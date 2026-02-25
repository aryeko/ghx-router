# Profiling Snapshot

Generated: 2026-02-25T17:55:48.189Z

> This file contains the profiling breakdown from the benchmark summary report.
> The full summary generator also produces gate/threshold checks and aggregate
> mode metrics, but those are omitted here because: (a) the gate profile
> (`verify_pr`) targets a different use case than this benchmark, (b) several
> aggregate columns (`Agent Time`, `CV`) report zero/NaN due to a known issue
> in the `latency_ms_agent` aggregation pipeline, and (c) cost is $0.00 across
> all runs (research preview). The JSONL files in this directory contain the
> complete per-run data for independent analysis.

## Time Allocation by Phase

| Phase | agent_direct (median ms) | ghx (median ms) | Delta |
|-------|-------------------------|-----------------|-------|
| Reasoning | 13,252 | 8,731 | -34% |
| Between reasoning and tool | 2,871 | 2,986 | +4% |
| Tool execution (bash) | 5,388 | 3,653 | -32% |
| Post-tool processing | 292 | 129 | -56% |
| **Assistant total** | **31,869** | **24,244** | **-24%** |

Source: 20 profiled runs per mode.

## Efficiency Snapshot

- Scenario coverage: 100.00% (4/4)
- Median active-token reduction: 27.55%
- Median latency reduction: 22.41%
- Median tool-call reduction: 16.67%
- Scenario win-rate (active tokens): 75.00% (4 comparable scenarios)
- Active-token reduction 95% CI: [-4.40, 55.07]
