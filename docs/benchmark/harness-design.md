# Benchmark Harness Design

## Flow

1. load and validate scenarios
2. render benchmark prompt
3. run assistant session
4. extract envelope JSON from assistant output
5. validate envelope + scenario assertions
6. collect tool/api/attempt metrics
7. write JSONL rows and aggregate reports

## Extractors

- `extractFirstJsonObject` - pulls first balanced JSON object
- `validateEnvelope` - validates required envelope and data constraints
- `aggregateToolCounts` - derives tool/api counts from session parts
- `extractAttemptMetrics` - reads `meta.attempts` for retry and route context

## Security Posture

- benchmark runner uses constrained permissions by default
- telemetry redaction avoids leaking sensitive runtime data

Source:

- `packages/benchmark/src/runner/suite-runner.ts`
- `packages/benchmark/src/extract/`
