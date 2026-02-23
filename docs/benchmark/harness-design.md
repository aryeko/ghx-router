# Benchmark Harness Design

## Flow

1. load and validate scenarios
2. run assistant session via `OpencodeSessionProvider`
3. extract prompt response from session messages
4. validate assertions (checkpoints) against GitHub state
5. collect tool/api metrics from session parts
6. write JSONL rows and aggregate reports

## Extractors

- `extractPromptResponseFromPromptResult` — parses the prompt response shape from the SDK result
- `coercePromptResponse` — normalises the prompt response into a canonical `{ assistant, parts }` shape
- `aggregateToolCounts` — derives `toolCalls` and `apiCalls` counts from session message parts
- `extractTimingBreakdown` — builds per-step timing from session message parts

## Security Posture

- benchmark runner uses constrained permissions by default
- telemetry redaction avoids leaking sensitive runtime data

Source:

- `packages/benchmark/src/provider/opencode/extraction.ts` — prompt response extraction and tool count aggregation
- `packages/benchmark/src/runner/suite.ts` — suite orchestration (modes, repetitions, JSONL output)
- `packages/benchmark/src/runner/scenario-runner.ts` — per-scenario iteration (session, prompt, assertions)
- `packages/benchmark/src/report/` — summary report generation
