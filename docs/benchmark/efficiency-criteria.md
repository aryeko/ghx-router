# Efficiency Criteria

`ghx` is validated when it meets all gate criteria against baseline modes on the same scenario set.

## Validation Thresholds (v2)

Gate v2 has two parts:

1. reliability checks over raw rows,
2. efficiency checks over stable rows.

Both must pass.

### Profile: `verify_pr`

**Reliability checks:**

- success-rate delta (`ghx - agent_direct`) >= -3 percentage points
- output validity rate >= 95%
- runner failure rate <= 7%
- timeout/stall rate <= 4%
- external retry rate <= 20%

**Efficiency checks (stable sample, ≥3 samples per scenario per mode):**

- scenario coverage >= 70%
- median active-token reduction >= 10%
- median latency reduction >= 10%
- median tool-call reduction >= 15%
- **cost reduction >= 10%** (new v2 gate)

### Profile: `verify_release`

**Reliability checks:**

- success-rate delta (`ghx - agent_direct`) >= -1 percentage point
- output validity rate >= 96%
- runner failure rate <= 6%
- timeout/stall rate <= 3%
- external retry rate <= 18%

**Efficiency checks (stable sample, ≥5 samples per scenario per mode):**

- scenario coverage >= 75%
- median active-token reduction >= 12%
- median latency reduction >= 12%
- median tool-call reduction >= 18%
- **cost reduction >= 15%** (new v2 gate)

## Legacy v1 Gate

The v1 gate remains reported for compatibility during migration, but gate enforcement should use v2.

## Measurement Requirements

- identical scenarios across compared modes
- repeated runs per scenario (minimum sample size verified per gate profile)
- fixed fixtures and model/provider per suite
- scenario-stratified aggregation for efficiency metrics
- median reporting with statistical metadata (p90, p95, IQR, CV)
- bootstrap confidence intervals on reduction deltas (95% level, 10k iterations)
- cost reduction check enforced on all scenarios (must meet profile minimum)
