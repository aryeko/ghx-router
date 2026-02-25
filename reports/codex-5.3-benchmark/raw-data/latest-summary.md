# Benchmark Validation Summary

Generated: 2026-02-25T17:55:48.189Z

## Mode Metrics

| Mode | Model | Runs | Success % | Output Valid % | Runner Error % | Timeout/Stall % | Retry % | Median Agent Time (ms) | Median Wall Time (ms) | P90 Agent Time (ms) | P95 Agent Time (ms) | IQR Agent Time (ms) | CV Agent Time % | Median Tokens (Total) | Median Tokens (Active) | P90 Tokens (Active) | P95 Tokens (Active) | Median Cost (USD) | Median Tool Calls |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| agent_direct | openai/gpt-5.3-codex/<null> | 20 | 100.00 | 100.00 | 0.00 | 0.00 | 0.00 | 0 | 34073 | 0 | 0 | 0 | NaN | 12282 | 910 | 10354 | 13125 | 0.0000 | 4.0 |
| ghx | openai/gpt-5.3-codex/<null> | 20 | 100.00 | 100.00 | 0.00 | 0.00 | 0.00 | 0 | 25411 | 0 | 0 | 0 | NaN | 12725 | 746 | 1149 | 1211 | 0.0000 | 3.0 |

## Profiling Snapshot

| Mode | Profiled Runs | Assistant Total (ms) | Reasoning (ms) | Between Reasoning->Tool (ms) | Tool Total (ms) | Bash Tool (ms) | Post-Tool (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| agent_direct | 20 | 31869 | 13252 | 2871 | 5388 | 5388 | 292 |
| ghx | 20 | 24244 | 8731 | 2986 | 3653 | 3653 | 129 |

## Gate

Profile: verify_pr
Overall Gate: **FAIL**

| Check | Value | Rule | Pass |
|---|---:|---:|:---:|
| reliability_success_rate_non_inferior | 0.00 | >= -3.00 | Y |
| reliability_output_validity | 100.00 | >= 97.00 | Y |
| reliability_runner_failure_rate | 0.00 | <= 5.00 | Y |
| reliability_timeout_stall_rate | 0.00 | <= 2.00 | Y |
| reliability_retry_rate | 0.00 | <= 15.00 | Y |
| efficiency_coverage | 100.00 | >= 80.00 | Y |
| efficiency_tokens_active_reduction | 27.55 | >= 15.00 | Y |
| efficiency_latency_reduction | 22.41 | >= 15.00 | Y |
| efficiency_tool_call_reduction | 16.67 | >= 20.00 | N |
| efficiency_cost_reduction | 0.00 | >= 10.00 | N |

### Reliability Snapshot

- success delta: 0.00 pp
- output validity: 100.00%
- runner failures: 0.00%
- timeout/stalls: 0.00%
- external retries: 0.00%

### Efficiency Snapshot (Stable Sample)

- scenario coverage: 100.00% (4/4)
- median active-token reduction: 27.55%
- median latency reduction: 22.41%
- median tool-call reduction: 16.67%
- scenario win-rate (active tokens): 75.00% (4 comparable scenarios)

### Delta vs Agent Direct

- cost reduction: 0.00%
- tokens active reduction CI: [-4.40, 55.07]
- latency reduction CI: [NaN, NaN]
