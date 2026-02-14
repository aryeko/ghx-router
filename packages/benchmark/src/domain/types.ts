export type BenchmarkMode = "agent_direct" | "mcp" | "ghx_router"

export type ScenarioAssertions = {
  must_succeed: boolean
  expect_valid_output?: boolean
  required_fields?: string[]
  required_data_fields?: string[]
  required_meta_fields?: string[]
  data_type?: "array" | "object"
  expected_route_used?: "cli" | "graphql" | "rest"
  expected_error_code?: string
  require_tool_calls?: boolean
  min_tool_calls?: number
  max_tool_calls?: number
  require_attempt_trace?: boolean
}

export type Scenario = {
  id: string
  name: string
  task: string
  input: Record<string, unknown>
  prompt_template: string
  timeout_ms: number
  allowed_retries: number
  fixture?: {
    repo?: string
    workdir?: string
    branch?: string
  }
  assertions: ScenarioAssertions
  tags: string[]
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

export type BenchmarkRow = {
  timestamp: string
  run_id: string
  mode: BenchmarkMode
  scenario_id: string
  iteration: number
  session_id: string | null
  success: boolean
  output_valid: boolean
  latency_ms_wall: number
  sdk_latency_ms: number | null
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
