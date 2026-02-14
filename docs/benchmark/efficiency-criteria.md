# Efficiency Criteria

`ghx` is validated when it meets all gate criteria against baseline modes on the same scenario set.

## Validation Thresholds (v2)

Gate v2 has two parts:

1. reliability checks over raw rows,
2. efficiency checks over stable rows.

Both must pass.

### Profile: `pr_fast`

Reliability:

- success-rate delta (`ghx - agent_direct`) >= -3 pp
- output validity >= 97%
- runner failure rate <= 5%
- timeout/stall rate <= 2%
- external retry rate <= 15%

Efficiency (stable sample):

- scenario coverage >= 80%
- median active-token reduction >= 15%
- median latency reduction >= 15%
- median tool-call reduction >= 20%

### Profile: `release_strict`

Reliability:

- success-rate delta (`ghx - agent_direct`) >= -1 pp
- output validity >= 99%
- runner failure rate <= 2%
- timeout/stall rate <= 1%
- external retry rate <= 8%

Efficiency (stable sample):

- scenario coverage >= 95%
- median active-token reduction >= 22%
- median latency reduction >= 20%
- median tool-call reduction >= 30%

## Legacy v1 Gate

The v1 gate remains reported for compatibility during migration, but gate enforcement should use v2.

## Measurement Requirements

- identical scenarios across compared modes
- repeated runs per scenario
- fixed fixtures and model/provider per suite
- scenario-stratified aggregation for efficiency metrics
- median reporting with run metadata (p90 optional)
