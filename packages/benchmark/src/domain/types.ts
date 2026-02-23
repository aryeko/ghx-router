export type BenchmarkMode = "agent_direct" | "mcp" | "ghx"

export type GateProfile = "verify_pr" | "verify_release"

export type GateThresholds = {
  minTokensActiveReductionPct: number
  minLatencyReductionPct: number
  minToolCallReductionPct: number
  minEfficiencyCoveragePct: number
  maxSuccessRateDropPct: number
  minOutputValidityRatePct: number
  maxRunnerFailureRatePct: number
  maxTimeoutStallRatePct: number
  maxRetryRatePct: number
  minSamplesPerScenarioPerMode: number
  minCostReductionPct: number
}

export type GateThresholdMap = Record<GateProfile, GateThresholds>

export type BenchmarkSummary = {
  generatedAt: string
  modes: Partial<Record<BenchmarkMode, ModeSummary>>
  profiling: Partial<Record<BenchmarkMode, ProfilingSummary>>
  delta: DeltaSummary | null
  gate: GateSummary
}

export type ModeSummary = {
  mode: BenchmarkMode
  modelSignature: string
  runs: number
  successRate: number
  outputValidityRate: number
  runnerFailureRate: number
  timeoutStallRate: number
  retryRate: number
  medianLatencyMs: number
  medianLatencyMsWall: number
  medianTokensTotal: number
  medianTokensActive: number
  medianToolCalls: number
  p90LatencyMs: number
  p95LatencyMs: number
  iqrLatencyMs: number
  cvLatency: number
  p90TokensActive: number
  p95TokensActive: number
  medianCostUsd: number
}

export type ProfilingSummary = {
  runsWithProfiling: number
  medianAssistantTotalMs: number
  medianAssistantReasoningMs: number
  medianAssistantBetweenReasoningAndToolMs: number
  medianToolTotalMs: number
  medianToolBashMs: number
  medianAssistantPostToolMs: number
}

export type DeltaSummary = {
  tokensReductionPct: number
  tokensActiveReductionPct: number
  latencyReductionPct: number
  toolCallReductionPct: number
  successRateDeltaPct: number
  outputValidityRatePct: number
  costReductionPct: number
  tokensActiveReductionCI: [number, number]
  latencyReductionCI: [number, number]
}

export type GateCheck = {
  name: string
  passed: boolean
  value: number
  threshold: number
  operator: ">=" | "<="
}

export type GateReliability = {
  successRateDeltaPct: number
  outputValidityRatePct: number
  runnerFailureRatePct: number
  timeoutStallRatePct: number
  retryRatePct: number
}

export type GateEfficiency = {
  minSamplesPerScenarioPerMode: number
  eligibleScenarioCount: number
  totalScenarioCount: number
  coveragePct: number
  tokensComparableScenarioCount: number
  tokensActiveReductionPct: number
  latencyReductionPct: number
  toolCallReductionPct: number
  scenarioWinRateTokensActivePct: number
}

export type GateSummary = {
  profile: GateProfile
  passed: boolean
  reliability: GateReliability | null
  efficiency: GateEfficiency | null
  checks: GateCheck[]
}

export type WorkflowCheckpoint = {
  name: string
  verification_task: string
  verification_input: Record<string, unknown>
  condition: "empty" | "non_empty" | "count_gte" | "count_eq" | "field_equals"
  expected_value?: unknown
  verification_field?: string
}

export type WorkflowAssertions = {
  expected_outcome: "success" | "expected_error"
  checkpoints: WorkflowCheckpoint[]
}

export type WorkflowScenario = {
  type: "workflow"
  id: string
  name: string
  prompt: string
  expected_capabilities: string[]
  timeout_ms: number
  allowed_retries: number
  fixture?: {
    repo?: string
    workdir?: string
    branch?: string
    bindings?: Record<string, string>
    requires?: string[]
    reseed_per_iteration?: boolean
  }
  assertions: WorkflowAssertions
  tags: string[]
}

export type Scenario = WorkflowScenario

export type FixtureManifest = {
  version: 1
  repo: {
    owner: string
    name: string
    full_name: string
    default_branch: string
  }
  resources: Record<string, unknown>
}

export type SessionMessagePart = {
  type: string
  text?: string
  tool?: string
  reason?: string
  [key: string]: unknown
}

export type SessionMessageEntry = {
  info?: {
    role?: string
  }
  parts?: SessionMessagePart[]
}

export type BenchmarkTimingBreakdown = {
  assistant_total_ms: number
  assistant_pre_reasoning_ms: number
  assistant_reasoning_ms: number
  assistant_between_reasoning_and_tool_ms: number
  assistant_post_tool_ms: number
  tool_total_ms: number
  tool_bash_ms: number
  tool_structured_output_ms: number
  observed_assistant_turns: number
}

export type BenchmarkRow = {
  timestamp: string
  run_id: string
  mode: BenchmarkMode
  scenario_id: string
  scenario_set: string | null
  iteration: number
  session_id: string | null
  success: boolean
  output_valid: boolean
  latency_ms_wall: number
  latency_ms_agent: number
  sdk_latency_ms: number | null
  timing_breakdown?: BenchmarkTimingBreakdown
  tokens: {
    input: number
    output: number
    reasoning: number
    cache_read: number
    cache_write: number
    total: number
  }
  cost: number
  tool_calls: number
  api_calls: number
  internal_retry_count: number
  external_retry_count: number
  model: {
    provider_id: string
    model_id: string
    mode: string | null
  }
  git: {
    repo: string | null
    commit: string | null
  }
  error: {
    type: string
    message: string
  } | null
}

export type HistoryEntry = {
  timestamp: string
  commit: string | null
  branch: string | null
  profile: GateProfile
  modes: Partial<Record<BenchmarkMode, ModeSummary>>
  gate_passed: boolean
}
