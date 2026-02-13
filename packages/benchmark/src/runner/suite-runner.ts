import { createOpencode } from "@opencode-ai/sdk"
import { spawnSync } from "node:child_process"
import { appendFile, mkdir } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"

import { extractFirstJsonObject, validateEnvelope } from "../extract/envelope.js"
import { extractAttemptMetrics } from "../extract/attempts.js"
import { aggregateToolCounts } from "../extract/tool-usage.js"
import type {
  BenchmarkMode,
  BenchmarkRow,
  Scenario,
  SessionMessageEntry,
  SessionMessagePart
} from "../domain/types.js"
import { loadScenarios } from "../scenario/loader.js"

type RunSuiteOptions = {
  mode: BenchmarkMode
  repetitions: number
  scenarioFilter: string | null
}

type AssistantMessage = {
  id: string
  sessionID: string
  time: {
    created: number
    completed?: number
  }
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
  cost: number
  error?: unknown
  role?: string
}

type PromptResponse = {
  info?: AssistantMessage
  parts?: SessionMessagePart[]
  id?: string
  sessionID?: string
  time?: {
    created: number
    completed?: number
  }
  tokens?: {
    input: number
    output: number
    reasoning: number
    cache: {
      read: number
      write: number
    }
  }
  cost?: number
  error?: unknown
}

const SCENARIOS_DIR = join(process.cwd(), "scenarios")
const RESULTS_DIR = join(process.cwd(), "results")

const PROVIDER_ID = process.env.BENCH_PROVIDER_ID ?? "openai"
const MODEL_ID = process.env.BENCH_MODEL_ID ?? "gpt-5.3-codex"
const OPEN_CODE_MODE = process.env.BENCH_OPENCODE_MODE ?? null
const GIT_REPO = process.env.BENCH_GIT_REPO ?? null
const GIT_COMMIT = process.env.BENCH_GIT_COMMIT ?? null

const modePromptPrefix: Record<BenchmarkMode, string> = {
  agent_direct:
    "You are running a benchmark in agent_direct mode. Use GitHub CLI (`gh`) commands directly to complete the task. Do not use any `ghx` command.",
  mcp: "You are running a benchmark in mcp mode. Prefer MCP tools when available.",
  ghx_router:
    "You are running a benchmark in ghx_router mode. Prefer `ghx run <task> --input ...` as the primary execution path."
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function unwrapData<T>(value: unknown, label: string): T {
  if (isObject(value) && "data" in value) {
    const wrapped = value as { data?: unknown; error?: unknown }
    if (wrapped.error) {
      throw new Error(`${label} returned error payload`)
    }
    return wrapped.data as T
  }

  return value as T
}

function getSessionApi(client: unknown): {
  create: (options: Record<string, unknown>) => Promise<unknown>
  promptAsync: (options: Record<string, unknown>) => Promise<unknown>
  messages: (options: Record<string, unknown>) => Promise<unknown>
  abort: (options: Record<string, unknown>) => Promise<unknown>
} {
  const session = (client as { session?: Record<string, unknown> }).session
  if (!session) {
    throw new Error("SDK client has no session API")
  }

  const create = session.create
  const promptAsync = session.promptAsync
  const messages = session.messages
  const abort = session.abort

  if (
    typeof create !== "function" ||
    typeof promptAsync !== "function" ||
    typeof messages !== "function" ||
    typeof abort !== "function"
  ) {
    throw new Error("SDK session API missing required methods")
  }

  return {
    create: (options) =>
      (create as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options
      ),
    promptAsync: (options) =>
      (
        promptAsync as (this: unknown, options: Record<string, unknown>) => Promise<unknown>
      ).call(session, options),
    messages: (options) =>
      (messages as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options
      ),
    abort: (options) =>
      (abort as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options
      )
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null
}

function hasAssistantMetadata(info: unknown): boolean {
  if (!isObject(info)) {
    return false
  }

  const hasCompleted =
    isObject(info.time) && typeof (info.time as { completed?: unknown }).completed === "number"
  const hasTokens =
    isObject(info.tokens) && typeof (info.tokens as { input?: unknown }).input === "number"

  return hasCompleted && hasTokens
}

function hasAssistantSignalParts(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "step-finish" || part.type === "tool")
}

function hasTextPart(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "text" && typeof part.text === "string")
}

function extractSnapshotFromParts(parts: SessionMessagePart[]): {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
  completed: number | null
} {
  const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
  if (!stepFinish) {
    return {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      completed: null
    }
  }

  const tokens = isObject(stepFinish.tokens) ? stepFinish.tokens : {}
  const cache = isObject(tokens.cache) ? tokens.cache : {}
  const time = isObject(stepFinish.time) ? stepFinish.time : {}

  return {
    input: asNumber(tokens.input) ?? 0,
    output: asNumber(tokens.output) ?? 0,
    reasoning: asNumber(tokens.reasoning) ?? 0,
    cacheRead: asNumber(cache.read) ?? 0,
    cacheWrite: asNumber(cache.write) ?? 0,
    cost: asNumber(stepFinish.cost) ?? 0,
    completed: asNumber(time.end)
  }
}

function coercePromptResponse(value: PromptResponse): {
  assistant: AssistantMessage
  parts: SessionMessagePart[]
} {
  if (value.info && (value.info.role === "assistant" || hasAssistantMetadata(value.info))) {
    const parts = value.parts ?? []
    const info = value.info
    const snapshot = extractSnapshotFromParts(parts)

    const created = asNumber(info.time?.created) ?? Date.now()
    const completed = asNumber(info.time?.completed) ?? snapshot.completed ?? undefined

    const input = asNumber(info.tokens?.input) ?? snapshot.input
    const output = asNumber(info.tokens?.output) ?? snapshot.output
    const reasoning = asNumber(info.tokens?.reasoning) ?? snapshot.reasoning
    const cacheRead = asNumber(info.tokens?.cache?.read) ?? snapshot.cacheRead
    const cacheWrite = asNumber(info.tokens?.cache?.write) ?? snapshot.cacheWrite

    return {
      assistant: {
        id: info.id,
        sessionID: info.sessionID,
        time: typeof completed === "number" ? { created, completed } : { created },
        tokens: {
          input,
          output,
          reasoning,
          cache: { read: cacheRead, write: cacheWrite }
        },
        cost: asNumber(info.cost) ?? snapshot.cost,
        error: info.error,
        role: info.role ?? "assistant"
      },
      parts
    }
  }

  const keys = isObject(value) ? Object.keys(value).join(",") : "non-object"
  throw new Error(`Unsupported prompt response shape (keys: ${keys})`)
}

function shouldRequestContinuation(parts: SessionMessagePart[]): boolean {
  const hasText = parts.some((part) => part.type === "text")
  const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")

  if (!stepFinish) {
    return !hasText
  }
  if (stepFinish.reason === "tool-calls") {
    return true
  }
  return !hasText
}

function extractEnvelopeFromParts(parts: SessionMessagePart[]): {
  text: string
  envelope: unknown | null
} {
  const text = parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")

  return { text, envelope: extractFirstJsonObject(text) }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout while waiting for ${label} after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchSessionMessages(
  sessionApi: ReturnType<typeof getSessionApi>,
  sessionId: string,
  limit = 100
): Promise<SessionMessageEntry[]> {
  const messagesResult = await sessionApi.messages({
    url: "/session/{id}/message",
    path: { id: sessionId },
    query: { limit }
  })

  return unwrapData<SessionMessageEntry[]>(messagesResult, "session.messages")
}

async function waitForAssistantFromMessages(
  sessionApi: ReturnType<typeof getSessionApi>,
  sessionId: string,
  timeoutMs: number,
  scenarioId: string,
  previousAssistantId?: string
): Promise<PromptResponse> {
  const started = Date.now()
  let pollCount = 0

  while (Date.now() - started < timeoutMs) {
    pollCount += 1
    const messages = await fetchSessionMessages(sessionApi, sessionId, 50)

    const previousIndex = previousAssistantId
      ? messages.findIndex((entry) => {
          if (!entry.info) {
            return false
          }

          return (entry.info as { id?: string }).id === previousAssistantId
        })
      : -1

    const candidates = previousIndex >= 0 ? messages.slice(previousIndex + 1) : messages

    const latestAssistant = [...candidates].reverse().find((entry) => {
      if (!entry.info) {
        return false
      }

      const role = (entry.info as { role?: unknown }).role
      const parts = entry.parts ?? []
      const assistantByRole = role === "assistant"
      const assistantByMetadata = hasAssistantMetadata(entry.info)
      const assistantBySignals = hasAssistantSignalParts(parts)

      if (!assistantByRole && !assistantByMetadata && !assistantBySignals) {
        return false
      }

      return assistantByMetadata || hasTextPart(parts) || assistantBySignals
    })

    if (latestAssistant?.info) {
      return {
        info: latestAssistant.info as AssistantMessage,
        parts: latestAssistant.parts ?? []
      }
    }

    if (pollCount % 5 === 0) {
      console.log(`[benchmark] waiting: scenario=${scenarioId} session=${sessionId} elapsed_ms=${Date.now() - started}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error("Timed out waiting for assistant message in session.messages")
}

function ghOk(args: string[]): boolean {
  const result = spawnSync("gh", args, { encoding: "utf8" })
  return result.status === 0
}

function validateFixture(scenario: Scenario): void {
  const repo = scenario.fixture?.repo
  if (!repo) return

  if (!ghOk(["repo", "view", repo, "--json", "name"])) {
    throw new Error(`fixture_invalid: repo not found or inaccessible: ${repo}`)
  }

  if (scenario.task === "issue.view") {
    const issueNumber =
      typeof scenario.input.issueNumber === "number" ? scenario.input.issueNumber : scenario.input.issue_number
    if (typeof issueNumber !== "number") {
      throw new Error("fixture_invalid: issue.view requires numeric input.issueNumber")
    }
    if (!ghOk(["issue", "view", String(issueNumber), "--repo", repo, "--json", "number"])) {
      throw new Error(`fixture_invalid: issue #${issueNumber} not found in ${repo}`)
    }
  }

  if (scenario.task === "pr.view") {
    const prNumber =
      typeof scenario.input.prNumber === "number" ? scenario.input.prNumber : scenario.input.pr_number
    if (typeof prNumber !== "number") {
      throw new Error("fixture_invalid: pr.view requires numeric input.prNumber")
    }
    if (!ghOk(["pr", "view", String(prNumber), "--repo", repo, "--json", "number"])) {
      throw new Error(`fixture_invalid: pr #${prNumber} not found in ${repo}`)
    }
  }
}

function renderPrompt(scenario: Scenario, mode: BenchmarkMode): string {
  const rendered = scenario.prompt_template
    .replaceAll("{{task}}", scenario.task)
    .replaceAll("{{scenario_id}}", scenario.id)
    .replaceAll("{{input_json}}", JSON.stringify(scenario.input))
    .replaceAll("{{fixture_repo}}", scenario.fixture?.repo ?? "")

  const fixtureNote = scenario.fixture?.repo ? `Target repository: ${scenario.fixture.repo}.` : ""
  const requiredDataFields = scenario.assertions.required_data_fields ?? []
  const dataContract =
    requiredDataFields.length > 0
      ? `The JSON data object MUST include: ${requiredDataFields.join(", ")}.`
      : "The JSON data field may be object or array based on task output."

  return `${modePromptPrefix[mode]}\n${fixtureNote}\nYou MUST use real tools to gather data. Do not fabricate outputs.\nReturn STRICT JSON only. No markdown fences.\nOutput must be exactly one JSON object with keys: ok, data, error, meta.\n${dataContract}\n\n${rendered}`
}

async function runScenario(
  client: unknown,
  scenario: Scenario,
  mode: BenchmarkMode,
  iteration: number
): Promise<BenchmarkRow> {
  const startedAt = Date.now()
  let sessionId: string | null = null

  try {
    const sessionApi = getSessionApi(client)
    const sessionResult = await withTimeout(sessionApi.create({ url: "/session" }), scenario.timeout_ms, "session.create")
    const session = unwrapData<{ id: string }>(sessionResult, "session.create")
    sessionId = session.id

    await withTimeout(
      sessionApi.promptAsync({
        url: "/session/{id}/prompt_async",
        path: { id: session.id },
        body: {
          model: { providerID: PROVIDER_ID, modelID: MODEL_ID },
          agent: OPEN_CODE_MODE ?? undefined,
          parts: [{ type: "text", text: renderPrompt(scenario, mode) }]
        }
      }),
      Math.min(15000, scenario.timeout_ms),
      "session.promptAsync"
    )

    const remainingTimeoutMs = Math.max(1000, scenario.timeout_ms - (Date.now() - startedAt))
    const hydrated = await waitForAssistantFromMessages(sessionApi, session.id, remainingTimeoutMs, scenario.id)
    let assistantAndParts = coercePromptResponse(hydrated)
    let extracted = extractEnvelopeFromParts(assistantAndParts.parts)

    let continuationCount = 0
    while ((shouldRequestContinuation(assistantAndParts.parts) || extracted.envelope === null) && continuationCount < 3) {
      continuationCount += 1
      const remaining = Math.max(1000, scenario.timeout_ms - (Date.now() - startedAt))

      await withTimeout(
        sessionApi.promptAsync({
          url: "/session/{id}/prompt_async",
          path: { id: session.id },
          body: {
            messageID: assistantAndParts.assistant.id,
            model: { providerID: PROVIDER_ID, modelID: MODEL_ID },
            agent: OPEN_CODE_MODE ?? undefined,
            parts: [{ type: "text", text: "Continue and return only one complete JSON object for the final envelope." }]
          }
        }),
        Math.min(10000, remaining),
        "session.promptAsync.continue"
      )

      const next = await waitForAssistantFromMessages(
        sessionApi,
        session.id,
        remaining,
        scenario.id,
        assistantAndParts.assistant.id
      )

      assistantAndParts = coercePromptResponse(next)
      extracted = extractEnvelopeFromParts(assistantAndParts.parts)
    }

    const { assistant } = assistantAndParts
    const envelope = extracted.envelope
    const outputValid = validateEnvelope(scenario.assertions, envelope)

    const allMessages = await fetchSessionMessages(sessionApi, session.id)
    const toolCounts = aggregateToolCounts(allMessages)
    const attemptMetrics = extractAttemptMetrics(envelope)
    const latencyWall = Date.now() - startedAt
    const sdkLatency =
      typeof assistant.time.completed === "number"
        ? Math.max(0, assistant.time.completed - assistant.time.created)
        : null

    const tokenTotal =
      assistant.tokens.input +
      assistant.tokens.output +
      assistant.tokens.reasoning +
      assistant.tokens.cache.read +
      assistant.tokens.cache.write

    const minToolCalls = scenario.assertions.min_tool_calls ?? 1
    const maxToolCalls = scenario.assertions.max_tool_calls
    const requireToolCalls = scenario.assertions.require_tool_calls ?? true
    const hasRequiredToolCalls = requireToolCalls ? toolCounts.toolCalls >= minToolCalls : true
    const hasValidMaxToolCalls = maxToolCalls === undefined ? true : toolCounts.toolCalls <= maxToolCalls
    const requiresAttemptTrace = scenario.assertions.require_attempt_trace ?? false
    const hasAttemptTrace = !requiresAttemptTrace || attemptMetrics.totalAttempts > 0
    const expectValidOutput = scenario.assertions.expect_valid_output ?? scenario.assertions.must_succeed
    const outputExpectationMet = expectValidOutput ? outputValid : !outputValid
    const errorReason = !outputExpectationMet
      ? `Output validation failed: outputValid=${outputValid}, expectValidOutput=${expectValidOutput}`
      : !hasRequiredToolCalls
        ? `Expected at least ${minToolCalls} tool call(s), got ${toolCounts.toolCalls}`
        : !hasValidMaxToolCalls
          ? `Expected at most ${maxToolCalls} tool call(s), got ${toolCounts.toolCalls}`
          : !hasAttemptTrace
            ? "Expected attempt trace metadata in output envelope"
        : null

    const success = outputExpectationMet && hasRequiredToolCalls && hasValidMaxToolCalls && hasAttemptTrace

    return {
      timestamp: new Date().toISOString(),
      run_id: randomUUID(),
      mode,
      scenario_id: scenario.id,
      iteration,
      session_id: sessionId,
      success,
      output_valid: outputValid,
      latency_ms_wall: latencyWall,
      sdk_latency_ms: sdkLatency,
      tokens: {
        input: assistant.tokens.input,
        output: assistant.tokens.output,
        reasoning: assistant.tokens.reasoning,
        cache_read: assistant.tokens.cache.read,
        cache_write: assistant.tokens.cache.write,
        total: tokenTotal
      },
      cost: assistant.cost,
      tool_calls: toolCounts.toolCalls,
      api_calls: toolCounts.apiCalls,
      internal_retry_count: attemptMetrics.retryCount,
      external_retry_count: 0,
      model: {
        provider_id: PROVIDER_ID,
        model_id: MODEL_ID,
        mode: OPEN_CODE_MODE
      },
      git: {
        repo: GIT_REPO,
        commit: GIT_COMMIT
      },
      error: errorReason
        ? {
            type: "assertion_failed",
            message: errorReason
          }
        : null
    }
  } catch (error: unknown) {
    if (sessionId) {
      const sessionApi = getSessionApi(client)
      await sessionApi.abort({ url: "/session/{id}/abort", path: { id: sessionId } }).catch(() => undefined)
    }

    return {
      timestamp: new Date().toISOString(),
      run_id: randomUUID(),
      mode,
      scenario_id: scenario.id,
      iteration,
      session_id: sessionId,
      success: false,
      output_valid: false,
      latency_ms_wall: Date.now() - startedAt,
      sdk_latency_ms: null,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache_read: 0,
        cache_write: 0,
        total: 0
      },
      cost: 0,
      tool_calls: 0,
      api_calls: 0,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: {
        provider_id: PROVIDER_ID,
        model_id: MODEL_ID,
        mode: OPEN_CODE_MODE
      },
      git: {
        repo: GIT_REPO,
        commit: GIT_COMMIT
      },
      error: {
        type: "runner_error",
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

export async function runSuite(options: RunSuiteOptions): Promise<void> {
  const { mode, repetitions, scenarioFilter } = options

  const { client, server } = await createOpencode({
    config: {
      permission: {
        edit: "deny",
        bash: "allow",
        webfetch: "allow",
        doom_loop: "deny",
        external_directory: "deny"
      }
    }
  })

  try {
    await mkdir(RESULTS_DIR, { recursive: true })
    const scenarios = await loadScenarios(SCENARIOS_DIR)
    const selectedScenarios = scenarioFilter
      ? scenarios.filter((scenario) => scenario.id === scenarioFilter)
      : scenarios

    if (selectedScenarios.length === 0) {
      throw new Error(
        scenarioFilter ? `No scenarios matched filter: ${scenarioFilter}` : "No benchmark scenarios found"
      )
    }

    const outFile = join(
      RESULTS_DIR,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode}-suite.jsonl`
    )

    for (const scenario of selectedScenarios) {
      validateFixture(scenario)

      for (let iteration = 1; iteration <= repetitions; iteration += 1) {
        let latestResult: BenchmarkRow | null = null

        for (let attempt = 0; attempt <= scenario.allowed_retries; attempt += 1) {
          const result = await runScenario(client, scenario, mode, iteration)
          latestResult = {
            ...result,
            external_retry_count: attempt
          }

          if (result.success || attempt === scenario.allowed_retries) {
            break
          }
        }

        if (!latestResult) {
          throw new Error(`No benchmark result produced for scenario ${scenario.id}`)
        }

        await appendFile(outFile, `${JSON.stringify(latestResult)}\n`, "utf8")
      }
    }

    console.log(`Wrote benchmark suite results: ${outFile}`)
  } finally {
    server.close()
  }
}
