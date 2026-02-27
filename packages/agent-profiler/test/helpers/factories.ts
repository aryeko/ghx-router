import type { PromptResult, SessionHandle } from "../../src/contracts/provider.js"
import type {
  CostBreakdown,
  TimingBreakdown,
  TokenBreakdown,
  ToolCallRecord,
} from "../../src/types/metrics.js"
import type { BaseScenario } from "../../src/types/scenario.js"
import type { SessionTrace } from "../../src/types/trace.js"

export function makeSessionHandle(overrides?: Partial<SessionHandle>): SessionHandle {
  return {
    sessionId: "ses_test_001",
    provider: "mock-provider",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

export function makePromptResult(overrides?: Partial<PromptResult>): PromptResult {
  return {
    text: "Mock agent output",
    metrics: {
      tokens: {
        input: 100,
        output: 50,
        reasoning: 20,
        cacheRead: 10,
        cacheWrite: 5,
        total: 150,
        active: 140,
      },
      timing: {
        wallMs: 1500,
        segments: [{ label: "prompt", startMs: 0, endMs: 1500 }],
      },
      toolCalls: [
        { name: "bash", category: "shell", success: true, durationMs: 200 },
        { name: "read_file", category: "file", success: true, durationMs: 50 },
        { name: "bash", category: "shell", success: false, durationMs: 100, error: "exit code 1" },
      ],
      cost: { totalUsd: 0.05, inputUsd: 0.02, outputUsd: 0.02, reasoningUsd: 0.01 },
    },
    completionReason: "stop",
    ...overrides,
  }
}

export function makeSessionTrace(overrides?: Partial<SessionTrace>): SessionTrace {
  return {
    sessionId: "ses_test_001",
    events: [],
    turns: [],
    summary: {
      totalTurns: 3,
      totalToolCalls: 3,
      totalTokens: {
        input: 100,
        output: 50,
        reasoning: 20,
        cacheRead: 0,
        cacheWrite: 0,
        total: 170,
        active: 150,
      },
      totalDuration: 1500,
    },
    ...overrides,
  }
}

export function makeScenario(overrides?: Partial<BaseScenario>): BaseScenario {
  return {
    id: "test-scenario-001",
    name: "Test Scenario",
    description: "A test scenario",
    prompt: "Fix the bug in main.ts",
    timeoutMs: 60_000,
    allowedRetries: 0,
    tags: ["test"],
    extensions: {},
    ...overrides,
  }
}

export const makeBaseScenario = makeScenario

export function makeTokenBreakdown(overrides?: Partial<TokenBreakdown>): TokenBreakdown {
  return {
    input: 100,
    output: 50,
    reasoning: 20,
    cacheRead: 10,
    cacheWrite: 5,
    total: 150,
    active: 140,
    ...overrides,
  }
}

export function makeTimingBreakdown(overrides?: Partial<TimingBreakdown>): TimingBreakdown {
  return {
    wallMs: 1500,
    segments: [{ label: "prompt", startMs: 0, endMs: 1500 }],
    ...overrides,
  }
}

export function makeCostBreakdown(overrides?: Partial<CostBreakdown>): CostBreakdown {
  return {
    totalUsd: 0.05,
    inputUsd: 0.02,
    outputUsd: 0.02,
    reasoningUsd: 0.01,
    ...overrides,
  }
}

export function makeToolCallRecord(overrides?: Partial<ToolCallRecord>): ToolCallRecord {
  return {
    name: "bash",
    category: "shell",
    success: true,
    durationMs: 200,
    ...overrides,
  }
}
