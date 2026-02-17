# Telemetry

The runtime emits structured telemetry events during capability execution. Events enable observability, debugging, and metrics collection.

## Event Types

Telemetry events are emitted from the routing engine and execution pipeline:

| Event | Emitted When | Fields |
|-------|--------------|--------|
| `route.plan` | Route plan is computed | `capability_id`, `routes`, `reason` |
| `route.preflight_skipped` | Preflight check is skipped | `capability_id`, `route`, `skip_reason` |
| `route.attempt` | Route execution is attempted | `capability_id`, `route`, `reason`, `attempt_number` |

### Event Structure

All events follow a consistent structure:

```typescript
{
  event: "route.plan" | "route.preflight_skipped" | "route.attempt"
  capability_id: string
  route: "cli" | "graphql" | "rest"
  reason: RouteReasonCode
  timestamp: ISO 8601 string
  context: {
    [key: string]: any   // Event-specific context
  }
}
```

### Example Events

**Route Plan**:
```json
{
  "event": "route.plan",
  "capability_id": "pr.view",
  "routes": ["cli", "graphql"],
  "reason": "CARD_PREFERRED",
  "timestamp": "2026-02-17T12:34:56Z"
}
```

**Route Attempt**:
```json
{
  "event": "route.attempt",
  "capability_id": "pr.view",
  "route": "cli",
  "reason": "CARD_PREFERRED",
  "attempt_number": 1,
  "timestamp": "2026-02-17T12:34:57Z",
  "context": {
    "duration_ms": 234,
    "success": true
  }
}
```

## Redaction

Telemetry is automatically redacted to prevent leaking sensitive data. Keys matching these patterns are masked:

- `token`, `auth`, `authorization`, `credential`
- `cookie`, `secret`, `password`, `key`, `apikey`
- `private`, `personal`, `sensitive`

Redaction is applied to all context values before events are emitted.

**Source**:
- `packages/core/src/core/telemetry/logger.ts`

## Enabling Output

Telemetry is disabled by default and does not emit to stdout. To capture telemetry events:

```bash
GHX_TELEMETRY_STDOUT=1 ghx run pr.view --input '{"owner":"rails","repo":"rails","pull_number":1}'
```

Events are emitted as JSONL (one JSON object per line) to stdout. Multiple events may be emitted per execution.

### Capturing to File

```bash
GHX_TELEMETRY_STDOUT=1 ghx run ... 2>&1 | jq -s '.' > telemetry.jsonl
```

### Integration

The benchmark harness uses telemetry events to:
- Measure route planning time
- Track retry and fallback patterns
- Compute per-route success rates
- Detect reliability issues

See [docs/benchmark/methodology.md](../benchmark/methodology.md) for benchmark use of telemetry.

## Benchmarking and Observability

Telemetry events support metrics collection and observability:

- **Route selection frequency** — count events by `(capability_id, route, reason)` to understand routing patterns
- **Retry patterns** — track `route.attempt` with `attempt_number > 1` to identify unreliable routes
- **Timing analysis** — measure `context.duration_ms` to profile slow routes
- **Error propagation** — correlate `route.attempt` success/failure with endpoint errors

These metrics feed the benchmark verification gates (see [docs/benchmark/efficiency-criteria.md](../benchmark/efficiency-criteria.md)).

## Related Documentation

- [system-design.md](system-design.md) — design overview including telemetry role
- [routing-engine.md](routing-engine.md) — route planning that emits events
- [docs/benchmark/harness-design.md](../benchmark/harness-design.md) — benchmark use of telemetry
