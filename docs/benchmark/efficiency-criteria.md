# Efficiency Criteria

`ghx_router` is validated when it meets all gate criteria against baseline modes on the same scenario set.

## Validation Thresholds (v1)

- >=25% median active-token reduction vs `agent_direct` (`input + output + reasoning + cache_write`)
- >=20% median latency reduction on common tasks
- >=30% tool-call reduction
- non-inferior success rate
- >=99% output validity

## Measurement Requirements

- identical scenarios across compared modes
- repeated runs per scenario
- fixed fixtures and model/provider per suite
- median and p90 reporting with run metadata
