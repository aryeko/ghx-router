# OpenCode Provider

> Back to [main design](./README.md)

---

## Overview

The OpenCode provider implements agent-profiler's `SessionProvider` contract
using the `@opencode-ai/sdk`. It manages OpenCode server lifecycle, creates
isolated sessions, sends prompts with SSE-based completion detection, and
exports session traces.

---

## Architecture

```
EvalRunner (via agent-profiler)
    |
    v
OpenCodeProvider implements SessionProvider
    |
    +-- init()
    |       |
    |       +-- Spawn OpenCode server on configured port
    |       +-- Create SDK client via @opencode-ai/sdk
    |       +-- Inject mode-specific env (from ModeResolver)
    |       +-- Verify server health
    |
    +-- createSession()
    |       |
    |       +-- client.session.create({ instructions })
    |       +-- Return SessionHandle
    |
    +-- prompt()
    |       |
    |       +-- client.session.promptAsync({ text })
    |       +-- Subscribe to SSE events via client.event.subscribe()
    |       +-- Wait for terminal event (session.idle / step-finish)
    |       +-- Extract metrics from completed message
    |       +-- Return PromptResult
    |
    +-- exportSession()
    |       |
    |       +-- Fetch all session messages via client.session.messages()
    |       +-- Convert to TraceEvent[] via trace-builder
    |       +-- Compute summary statistics
    |       +-- Return SessionTrace
    |
    +-- destroySession()
    |       |
    |       +-- No-op (sessions are stateless on the server side)
    |
    +-- shutdown()
            |
            +-- Close SSE subscription
            +-- Kill OpenCode server process
            +-- Clean up temp directories
```

---

## SSE-Based Completion Detection

The key improvement over the current benchmark's polling approach. Instead of
checking `session.messages` every 300ms and heuristically detecting completion,
the provider subscribes to SSE events:

### Current (polling) -- replaced

```typescript
// ~200 lines of brittle heuristic detection
async function waitForAssistantFromMessages(client, sessionId): Promise<...> {
  while (true) {
    const messages = await client.session.messages(sessionId)
    // Check for various completion signals...
    // Handle edge cases...
    // Detect stalls...
    await sleep(300)
  }
}
```

### New (SSE events)

```typescript
async function waitForCompletion(
  client: OpenCodeClient,
  sessionId: string,
  timeoutMs: number,
): Promise<PromptResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new TimeoutError(sessionId, timeoutMs)),
      timeoutMs,
    )

    const subscription = client.event.subscribe({
      filter: { sessionId },
    })

    for await (const event of subscription) {
      if (event.type === "session.idle" || isTerminalEvent(event)) {
        clearTimeout(timeout)
        subscription.close()

        const metrics = await extractMetrics(client, sessionId)
        resolve(metrics)
        return
      }
    }
  })
}

function isTerminalEvent(event: OpenCodeEvent): boolean {
  return (
    event.type === "session.idle" ||
    event.type === "session.error" ||
    (event.type === "step-finish" && event.data?.reason === "stop")
  )
}
```

### Benefits

| Aspect | Polling | SSE |
|--------|---------|-----|
| Completion detection | Heuristic, ~200 lines | Event-driven, ~50 lines |
| Latency accuracy | +/- 300ms (polling interval) | Near-exact |
| Stall detection | Complex timeout logic | Built-in via SSE timeout |
| Server load | Continuous API calls | Single persistent connection |
| Reliability | Flaky (race conditions) | Deterministic |

---

## Metric Extraction

Metrics are extracted from two sources after the SSE event signals completion:

### 1. From Completed Message (immediate, per-turn)

After the terminal SSE event, the provider fetches the completed assistant
message and extracts:

```typescript
async function extractMetrics(
  client: OpenCodeClient,
  sessionId: string,
): Promise<PromptResult> {
  const messages = await client.session.messages(sessionId)
  const lastAssistant = messages.findLast(m => m.role === "assistant")

  return {
    text: extractText(lastAssistant),
    metrics: {
      tokens: {
        input: lastAssistant.tokens.input,
        output: lastAssistant.tokens.output,
        reasoning: lastAssistant.tokens.reasoning ?? 0,
        cacheRead: lastAssistant.tokens.cache_read ?? 0,
        cacheWrite: lastAssistant.tokens.cache_write ?? 0,
        total: lastAssistant.tokens.input + lastAssistant.tokens.output,
        active: (lastAssistant.tokens.input + lastAssistant.tokens.output)
                - (lastAssistant.tokens.cache_read ?? 0),
      },
      timing: extractTiming(lastAssistant),
      toolCalls: extractToolCalls(lastAssistant),
      cost: {
        totalUsd: lastAssistant.cost?.total ?? 0,
        inputUsd: lastAssistant.cost?.input ?? 0,
        outputUsd: lastAssistant.cost?.output ?? 0,
        reasoningUsd: lastAssistant.cost?.reasoning ?? 0,
      },
    },
    completionReason: mapCompletionReason(lastAssistant),
  }
}
```

### 2. From Session Trace (post-hoc, full session)

After the iteration completes, `exportSession()` fetches all messages and
builds a complete trace using the trace builder:

```typescript
async function exportSession(handle: SessionHandle): Promise<SessionTrace> {
  const messages = await client.session.messages(handle.sessionId)
  const events = traceBuilder.convertMessages(messages)
  const turns = traceBuilder.groupIntoTurns(events)

  return {
    sessionId: handle.sessionId,
    events,
    turns,
    summary: computeSummary(events, turns),
  }
}
```

---

## Trace Builder

Converts OpenCode session messages (provider-specific format) into the
profiler's generic `TraceEvent[]` stream:

```typescript
class TraceBuilder implements TraceNormalizer {
  normalize(rawTrace: SessionTrace): readonly TraceEvent[] {
    // Convert OpenCode message parts to TraceEvent[]
    // - "reasoning" parts -> TraceEvent { type: "reasoning" }
    // - "tool" parts      -> TraceEvent { type: "tool_call" }
    // - "text" parts      -> TraceEvent { type: "text_output" }
    // - message boundaries -> TraceEvent { type: "turn_boundary" }
    // - error states       -> TraceEvent { type: "error" }
  }
}
```

This is the bridge between OpenCode's data model and the profiler's generic
analysis pipeline.

---

## Session Isolation

Each evaluation iteration gets:

1. **Fresh OpenCode session** -- `createSession()` per iteration
2. **Isolated config directory** -- temp `XDG_CONFIG_HOME` per provider init
3. **Clean environment** -- only evaluation-controlled env vars
4. **Mode-specific PATH/config** -- injected by `ModeResolver`

The OpenCode **server** is reused across iterations within the same
(mode, model) group. Server startup is expensive (2-5s); session isolation is
achieved at the session level.

---

## Health Check

Called before each `createSession()`. If unhealthy, restart and retry once:

```typescript
async function healthCheck(client: OpenCodeClient): Promise<boolean> {
  try {
    await client.session.list()
    return true
  } catch {
    return false
  }
}
```

---

## Server Lifecycle

```
eval run starts
    |
    v
For each (mode, model) group:
    |
    +-- ModeResolver.resolve(mode) --> env vars, system instructions
    |
    +-- provider.init(config)
    |       +-- Spawn OpenCode server (or reuse if healthy)
    |       +-- Verify health
    |
    +-- For each scenario:
    |     For each iteration:
    |       +-- provider.createSession()
    |       +-- provider.prompt()        --> PromptResult
    |       +-- provider.exportSession() --> SessionTrace
    |       +-- provider.destroySession()
    |
    +-- provider.shutdown() (or keep alive for next model with same mode)
```

---

## Testing Strategy

The trace builder is the highest-priority testing target in the OpenCode
provider. It converts provider-specific message formats into the profiler's
generic `TraceEvent[]` stream, and incorrect conversion silently corrupts all
downstream analysis.

### Trace Builder Testing

**Fixture-based approach:**

Capture 5-10 real OpenCode sessions as JSON fixtures covering representative
scenarios:

1. **Simple single-turn** -- one prompt, one response, no tool calls
2. **Multi-tool session** -- multiple tool calls in sequence
3. **Split reasoning blocks** -- reasoning that spans multiple message parts
   (OpenCode sometimes splits long reasoning into consecutive `reasoning`
   parts)
4. **Tool errors mid-stream** -- a tool call that returns an error, followed
   by agent recovery
5. **Reasoning vs text_output boundaries** -- consecutive `reasoning` and
   `text` parts where the boundary must be preserved (not merged)
6. **Empty/minimal responses** -- edge case where the agent produces no text
   output
7. **Session with timeout** -- agent hits the timeout before completion
8. **Multi-turn conversation** -- multiple prompt/response cycles in one
   session

**Test structure:**

```typescript
// test/unit/trace-builder.test.ts
describe("TraceBuilder", () => {
  for (const fixture of loadFixtures("opencode-sessions")) {
    it(`normalizes ${fixture.name}`, () => {
      const events = builder.normalize(fixture.rawTrace)
      expect(events).toMatchSnapshot()
      // Also verify structural invariants:
      // - Every tool_call has a matching tool_result
      // - Turn boundaries are correctly placed
      // - Token counts are non-negative
    })
  }

  it("handles split reasoning blocks", () => { /* ... */ })
  it("handles tool errors mid-stream", () => { /* ... */ })
  it("preserves reasoning vs text_output boundaries", () => { /* ... */ })
})
```

Fixtures are stored as JSON files in `test/fixtures/opencode-sessions/` and
committed to the repository. When the OpenCode message format changes, update
the fixtures and re-validate snapshots.
