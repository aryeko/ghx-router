import type { ProfileRow } from "../../../src/types/profile-row.js"

export function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    runId: "run_test",
    scenarioId: "s1",
    mode: "mode_a",
    model: "test-model",
    iteration: 0,
    startedAt: "2026-02-27T00:00:00.000Z",
    completedAt: "2026-02-27T00:01:00.000Z",
    tokens: {
      input: 100,
      output: 50,
      reasoning: 20,
      cacheRead: 10,
      cacheWrite: 5,
      total: 150,
      active: 140,
    },
    timing: { wallMs: 1500, segments: [] },
    toolCalls: {
      total: 3,
      byCategory: { shell: 2, file: 1 },
      failed: 0,
      retried: 0,
      errorRate: 0,
      records: [],
    },
    cost: {
      totalUsd: 0.05,
      inputUsd: 0.02,
      outputUsd: 0.02,
      reasoningUsd: 0.01,
    },
    success: true,
    checkpointsPassed: 3,
    checkpointsTotal: 3,
    checkpointDetails: [],
    outputValid: true,
    provider: "test",
    sessionId: "ses_001",
    agentTurns: 3,
    completionReason: "stop",
    extensions: {},
    ...overrides,
  } satisfies ProfileRow
}
