# Telemetry

Runtime emits structured telemetry events from execute orchestration.

## Event Names

- `route.plan`
- `route.preflight_skipped`
- `route.attempt`

## Redaction

Telemetry context is sanitized by key-based redaction (`token`, `authorization`, `cookie`, `secret`, etc).

Source:

- `packages/ghx-router/src/core/telemetry/logger.ts`

## Enabling Output

Telemetry JSONL output is disabled by default.

Set:

```bash
GHX_TELEMETRY_STDOUT=1
```

to emit telemetry events to stdout.
