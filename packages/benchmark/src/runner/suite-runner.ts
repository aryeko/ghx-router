import { randomUUID } from "node:crypto"
import { access, appendFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import type {
  BenchmarkMode,
  BenchmarkRow,
  BenchmarkTimingBreakdown,
  FixtureManifest,
  Scenario,
  SessionMessageEntry,
  SessionMessagePart,
  WorkflowCheckpoint,
  WorkflowScenario,
} from "../domain/types.js"
import { aggregateToolCounts } from "../extract/tool-usage.js"
import { mintFixtureAppToken } from "../fixture/app-auth.js"
import { loadFixtureManifest, resolveWorkflowFixtureBindings } from "../fixture/manifest.js"
import { resetPrReviewThreads, seedFixtureManifest } from "../fixture/seed.js"
import { loadScenarioSets, loadScenarios } from "../scenario/loader.js"
import { isObject } from "../utils/guards.js"
import { type BenchmarkClient, withIsolatedBenchmarkClient } from "./client-lifecycle.js"
import { loadRunnerConfig, type RunnerConfig } from "./config.js"
import { renderWorkflowPrompt } from "./prompt/prompt-renderer.js"
import {
  hasAssistantMetadata,
  hasAssistantSignal,
  hasStructuredOutput,
  hasTextPart,
  messageProgressSignature,
} from "./session-polling.js"

type RunSuiteOptions = {
  mode: BenchmarkMode
  repetitions: number
  scenarioFilter: string[] | null
  scenarioSet?: string | null
  fixtureManifestPath?: string | null
  seedIfMissing?: boolean
  providerId?: string | null
  modelId?: string | null
  outputJsonlPath?: string | null
  skipWarmup?: boolean
  config?: RunnerConfig
}

const DEFAULT_FIXTURE_MANIFEST_PATH = "fixtures/latest.json"
const BENCH_PROGRESS_EVENTS_MODE = "jsonl"

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
  structured_output?: unknown
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

export function unwrapData<T>(value: unknown, label: string): T {
  if (isObject(value) && "data" in value) {
    const wrapped = value as { data?: unknown; error?: unknown }
    if (wrapped.error) {
      throw new Error(`${label} returned error payload`)
    }
    return wrapped.data as T
  }

  return value as T
}

export function getSessionApi(client: unknown): {
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
    create: (options: Record<string, unknown>) =>
      (create as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options,
      ),
    promptAsync: (options: Record<string, unknown>) =>
      (promptAsync as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options,
      ),
    messages: (options: Record<string, unknown>) =>
      (messages as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options,
      ),
    abort: (options: Record<string, unknown>) =>
      (abort as (this: unknown, options: Record<string, unknown>) => Promise<unknown>).call(
        session,
        options,
      ),
  }
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null
}

export function extractTimingBreakdown(messages: SessionMessageEntry[]): BenchmarkTimingBreakdown {
  const breakdown: BenchmarkTimingBreakdown = {
    assistant_total_ms: 0,
    assistant_pre_reasoning_ms: 0,
    assistant_reasoning_ms: 0,
    assistant_between_reasoning_and_tool_ms: 0,
    assistant_post_tool_ms: 0,
    tool_total_ms: 0,
    tool_bash_ms: 0,
    tool_structured_output_ms: 0,
    observed_assistant_turns: 0,
  }

  for (const message of messages) {
    const info = isObject(message.info) ? (message.info as Record<string, unknown>) : null
    if (!info || info.role !== "assistant") {
      continue
    }

    const infoTime = isObject(info.time) ? info.time : null
    const created = asNumber((infoTime?.created as unknown) ?? null)
    const completed = asNumber((infoTime?.completed as unknown) ?? null)
    const parts = Array.isArray(message.parts) ? message.parts : []

    if (typeof created === "number" && typeof completed === "number") {
      breakdown.assistant_total_ms += Math.max(0, completed - created)
    }
    breakdown.observed_assistant_turns += 1

    const reasoningParts = parts.filter((part) => part.type === "reasoning")
    const toolParts = parts.filter((part) => part.type === "tool")

    let firstReasoningStart: number | null = null
    let lastReasoningEnd: number | null = null
    for (const part of reasoningParts) {
      const time = isObject(part.time) ? part.time : null
      const start = asNumber((time?.start as unknown) ?? null)
      const end = asNumber((time?.end as unknown) ?? null)
      if (typeof start === "number" && typeof end === "number") {
        breakdown.assistant_reasoning_ms += Math.max(0, end - start)
        if (firstReasoningStart === null || start < firstReasoningStart) {
          firstReasoningStart = start
        }
        if (lastReasoningEnd === null || end > lastReasoningEnd) {
          lastReasoningEnd = end
        }
      }
    }

    let firstToolStart: number | null = null
    let lastToolEnd: number | null = null
    for (const part of toolParts) {
      const state = isObject(part.state) ? part.state : null
      const time = isObject(state?.time) ? state.time : null
      const tool = typeof part.tool === "string" ? part.tool : ""
      const start = asNumber((time?.start as unknown) ?? null)
      const end = asNumber((time?.end as unknown) ?? null)

      if (typeof start === "number" && typeof end === "number") {
        const duration = Math.max(0, end - start)
        breakdown.tool_total_ms += duration
        if (tool === "bash") {
          breakdown.tool_bash_ms += duration
        }
        if (tool === "StructuredOutput") {
          breakdown.tool_structured_output_ms += duration
        }

        if (firstToolStart === null || start < firstToolStart) {
          firstToolStart = start
        }
        if (lastToolEnd === null || end > lastToolEnd) {
          lastToolEnd = end
        }
      }
    }

    if (typeof created === "number" && firstReasoningStart !== null) {
      breakdown.assistant_pre_reasoning_ms += Math.max(0, firstReasoningStart - created)
    }

    if (lastReasoningEnd !== null && firstToolStart !== null) {
      breakdown.assistant_between_reasoning_and_tool_ms += Math.max(
        0,
        firstToolStart - lastReasoningEnd,
      )
    }

    if (typeof completed === "number" && lastToolEnd !== null) {
      breakdown.assistant_post_tool_ms += Math.max(0, completed - lastToolEnd)
    }
  }

  return breakdown
}

export function extractSnapshotFromParts(parts: SessionMessagePart[]): {
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
      completed: null,
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
    completed: asNumber(time.end),
  }
}

export function coercePromptResponse(value: PromptResponse): {
  assistant: AssistantMessage
  parts: SessionMessagePart[]
} {
  const parts = value.parts ?? []
  const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
  const hasCompletedStep =
    stepFinish !== undefined && stepFinish.reason !== "tool-calls" && stepFinish.reason !== "error"
  const hasUsableMetadata =
    value.info !== undefined &&
    hasAssistantMetadata(value.info) &&
    (hasCompletedStep || hasTextPart(parts) || hasStructuredOutput(value.info))
  const textOnlySignal = hasTextPart(parts) && stepFinish?.reason !== "tool-calls"

  if (value.info && (hasUsableMetadata || hasCompletedStep || textOnlySignal)) {
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
        id: info.id ?? value.id ?? "assistant-unknown",
        sessionID: info.sessionID ?? value.sessionID ?? "session-unknown",
        time: typeof completed === "number" ? { created, completed } : { created },
        tokens: {
          input,
          output,
          reasoning,
          cache: { read: cacheRead, write: cacheWrite },
        },
        cost: asNumber(info.cost) ?? snapshot.cost,
        error: info.error,
        role: info.role ?? "assistant",
        structured_output:
          (info as { structured_output?: unknown; structured?: unknown }).structured_output ??
          (info as { structured_output?: unknown; structured?: unknown }).structured,
      },
      parts,
    }
  }

  const keys = isObject(value) ? Object.keys(value).join(",") : "non-object"
  throw new Error(`Unsupported prompt response shape (keys: ${keys})`)
}

export function shouldRequestContinuation(parts: SessionMessagePart[]): boolean {
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

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout while waiting for ${label} after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function fetchSessionMessages(
  sessionApi: ReturnType<typeof getSessionApi>,
  sessionId: string,
  limit = 100,
): Promise<SessionMessageEntry[]> {
  const messagesResult = await sessionApi.messages({
    url: "/session/{id}/message",
    path: { id: sessionId },
    query: { limit },
  })

  return unwrapData<SessionMessageEntry[]>(messagesResult, "session.messages")
}

export async function waitForAssistantFromMessages(
  sessionApi: ReturnType<typeof getSessionApi>,
  sessionId: string,
  timeoutMs: number,
  scenarioId: string,
  previousAssistantId?: string,
  config?: RunnerConfig,
): Promise<PromptResponse> {
  const cfg = config ?? loadRunnerConfig()
  const started = Date.now()
  let lastWaitLogAt = started
  let lastProgressAt = started
  let lastSignature = ""
  const firstAssistantBudgetMs = Math.min(
    timeoutMs,
    Number.isFinite(cfg.firstAssistantTimeoutMs) && cfg.firstAssistantTimeoutMs > 0
      ? cfg.firstAssistantTimeoutMs
      : timeoutMs,
  )
  const stallBudgetMs = Math.min(
    timeoutMs,
    Number.isFinite(cfg.sessionStallTimeoutMs) && cfg.sessionStallTimeoutMs > 0
      ? cfg.sessionStallTimeoutMs
      : timeoutMs,
  )

  const getCreatedAt = (entry: SessionMessageEntry): number => {
    if (!entry.info || !isObject(entry.info)) {
      return Number.NEGATIVE_INFINITY
    }

    const info = entry.info as { time?: unknown }
    return (
      asNumber((isObject(info.time) ? info.time.created : undefined) as unknown) ??
      Number.NEGATIVE_INFINITY
    )
  }

  while (Date.now() - started < timeoutMs) {
    const now = Date.now()
    const messages = await fetchSessionMessages(sessionApi, sessionId, 50)
    const signature = messageProgressSignature(messages)
    if (signature !== lastSignature) {
      lastSignature = signature
      lastProgressAt = now
    }

    if (
      !previousAssistantId &&
      !messages.some((entry) => hasAssistantSignal(entry)) &&
      now - started >= firstAssistantBudgetMs
    ) {
      throw new Error(
        `No assistant message received in session.messages within ${firstAssistantBudgetMs}ms`,
      )
    }

    if (messages.length > 0 && now - lastProgressAt >= stallBudgetMs) {
      throw new Error(`Session message stream stalled in session.messages for ${stallBudgetMs}ms`)
    }

    const candidates = previousAssistantId
      ? messages.filter((entry) => {
          if (!entry.info) {
            return false
          }

          const currentId = (entry.info as { id?: string }).id
          return currentId !== previousAssistantId
        })
      : messages

    const latestAssistant = [...candidates].reverse().find((entry) => {
      if (!entry.info) {
        return false
      }

      const role = (entry.info as { role?: unknown }).role
      const parts = entry.parts ?? []
      const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
      const assistantByRole = role === "assistant"
      const assistantByMetadata = hasAssistantMetadata(entry.info)
      const assistantWithStructuredOutput = hasStructuredOutput(entry.info)
      const assistantByTextSignal =
        previousAssistantId !== undefined &&
        hasTextPart(parts) &&
        stepFinish?.reason !== "tool-calls"
      const hasCompletedStep =
        stepFinish !== undefined &&
        stepFinish.reason !== "tool-calls" &&
        stepFinish.reason !== "error"
      const isCompletedAssistant =
        (assistantByMetadata &&
          (hasCompletedStep || hasTextPart(parts) || assistantWithStructuredOutput)) ||
        hasCompletedStep ||
        assistantWithStructuredOutput

      if (!assistantByRole && !assistantByMetadata && !assistantByTextSignal) {
        return false
      }

      return isCompletedAssistant || assistantByTextSignal
    })

    if (latestAssistant?.info) {
      return {
        info: latestAssistant.info as AssistantMessage,
        parts: latestAssistant.parts ?? [],
      }
    }

    if (previousAssistantId) {
      const continuedSameMessageCandidates = messages.filter((entry) => {
        if (!entry.info) {
          return false
        }

        const currentId = (entry.info as { id?: string }).id
        if (currentId !== previousAssistantId) {
          return false
        }

        const parts = entry.parts ?? []
        const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
        const assistantByMetadata = hasAssistantMetadata(entry.info)
        const assistantWithStructuredOutput = hasStructuredOutput(entry.info)
        const hasCompletedStep =
          stepFinish !== undefined &&
          stepFinish.reason !== "tool-calls" &&
          stepFinish.reason !== "error"
        return (
          assistantWithStructuredOutput ||
          (assistantByMetadata &&
            (hasCompletedStep || hasTextPart(parts) || assistantWithStructuredOutput)) ||
          (hasTextPart(parts) && hasCompletedStep)
        )
      })

      const continuedSameMessage =
        continuedSameMessageCandidates.reduce<SessionMessageEntry | null>((latest, entry) => {
          if (!latest) {
            return entry
          }

          return getCreatedAt(entry) >= getCreatedAt(latest) ? entry : latest
        }, null)

      if (continuedSameMessage?.info) {
        return {
          info: continuedSameMessage.info as AssistantMessage,
          parts: continuedSameMessage.parts ?? [],
        }
      }
    }

    if (now - lastWaitLogAt >= 5000) {
      console.log(
        `[benchmark] waiting: scenario=${scenarioId} session=${sessionId} elapsed_ms=${now - started}`,
      )
      lastWaitLogAt = now
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error("Timed out waiting for assistant message in session.messages")
}

export function extractPromptResponseFromPromptResult(value: unknown): PromptResponse | null {
  const payload = unwrapData<unknown>(value, "session.promptAsync")

  if (!isObject(payload)) {
    return null
  }

  const assistant = (payload as { assistant?: unknown }).assistant
  const parts = (payload as { parts?: unknown }).parts
  if (isObject(assistant) && Array.isArray(parts)) {
    return {
      info: assistant as AssistantMessage,
      parts: parts as SessionMessagePart[],
    }
  }

  if (isObject(payload.info) || Array.isArray(payload.parts)) {
    return payload as PromptResponse
  }

  const message = (payload as { message?: unknown }).message
  if (
    isObject(message) &&
    (isObject(message.info) || Array.isArray((message as { parts?: unknown }).parts))
  ) {
    return message as PromptResponse
  }

  return null
}

export function resolveCheckpointData(data: unknown): unknown {
  if (isObject(data) && "items" in data && Array.isArray((data as Record<string, unknown>).items)) {
    return (data as Record<string, unknown>).items
  }
  return data
}

export function evaluateCheckpoint(
  checkpoint: WorkflowCheckpoint,
  result: { ok: boolean; data?: unknown },
): boolean {
  if (!result.ok) {
    return false
  }

  const data = resolveCheckpointData(result.data)

  switch (checkpoint.condition) {
    case "empty":
      return Array.isArray(data) ? data.length === 0 : data === null || data === undefined
    case "non_empty":
      return Array.isArray(data) ? data.length > 0 : data !== null && data !== undefined
    case "count_gte":
      return Array.isArray(data) && data.length >= Number(checkpoint.expected_value)
    case "count_eq":
      return Array.isArray(data) && data.length === Number(checkpoint.expected_value)
    case "field_equals": {
      if (!isObject(data) || !isObject(checkpoint.expected_value)) {
        return false
      }
      const expected = checkpoint.expected_value as Record<string, unknown>
      const actual = data as Record<string, unknown>
      return Object.entries(expected).every(
        ([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value),
      )
    }
    default:
      return false
  }
}

export async function runWorkflowScenario(
  benchmarkClient: BenchmarkClient,
  scenario: WorkflowScenario,
  mode: BenchmarkMode,
  iteration: number,
  scenarioSet: string | null = null,
  modelOverride?: { providerId?: string; modelId?: string },
  config?: RunnerConfig,
): Promise<BenchmarkRow> {
  const cfg = config ?? loadRunnerConfig()
  const workflowStallTimeout = Math.floor(scenario.timeout_ms / 3)
  const workflowConfig: RunnerConfig = {
    ...cfg,
    sessionStallTimeoutMs: Math.max(cfg.sessionStallTimeoutMs ?? 0, workflowStallTimeout),
  }
  const providerId = modelOverride?.providerId ?? process.env.BENCH_PROVIDER_ID ?? "openai"
  const modelId = modelOverride?.modelId ?? process.env.BENCH_MODEL_ID ?? "gpt-5.1-codex-mini"
  const { client, systemInstruction } = benchmarkClient
  const scenarioStartedAt = Date.now()
  let externalRetryCount = 0

  while (true) {
    const attemptStartedAt = Date.now()
    let sessionId: string | null = null

    try {
      const sessionApi = getSessionApi(client)
      const sessionResult = await withTimeout(
        sessionApi.create({ url: "/session" }),
        scenario.timeout_ms,
        "session.create",
      )
      const session = unwrapData<{ id: string }>(sessionResult, "session.create")
      sessionId = session.id

      const promptResult = await withTimeout(
        sessionApi.promptAsync({
          url: "/session/{id}/prompt_async",
          path: { id: session.id },
          body: {
            model: { providerID: providerId, modelID: modelId },
            agent: workflowConfig.openCodeMode ?? undefined,
            system: systemInstruction,
            parts: [{ type: "text", text: renderWorkflowPrompt(scenario, mode) }],
          },
        }),
        Math.min(15000, scenario.timeout_ms),
        "session.promptAsync",
      )

      const remainingTimeoutMs = Math.max(
        1000,
        scenario.timeout_ms - (Date.now() - attemptStartedAt),
      )
      const immediatePrompt = extractPromptResponseFromPromptResult(promptResult)
      const hydrated =
        immediatePrompt ??
        (await waitForAssistantFromMessages(
          sessionApi,
          session.id,
          remainingTimeoutMs,
          scenario.id,
          undefined,
          workflowConfig,
        ))
      const assistantAndParts = coercePromptResponse(hydrated)
      const assistant = assistantAndParts.assistant

      const allMessages = await fetchSessionMessages(sessionApi, session.id)
      const toolCounts = aggregateToolCounts(allMessages)
      const timingBreakdown = extractTimingBreakdown(allMessages)

      const checkpointResults: Array<{ name: string; passed: boolean }> = []

      const { executeTask, createGithubClientFromToken } = await import("@ghx-dev/core")
      const ghToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? ""
      const githubClient = createGithubClientFromToken(ghToken)

      for (const checkpoint of scenario.assertions.checkpoints) {
        try {
          const verificationResult = await executeTask(
            {
              task: checkpoint.verification_task,
              input: checkpoint.verification_input,
            },
            {
              githubClient,
              githubToken: ghToken,
              skipGhPreflight: true,
            },
          )

          const passed = evaluateCheckpoint(checkpoint, verificationResult)
          checkpointResults.push({ name: checkpoint.name, passed })
        } catch {
          checkpointResults.push({ name: checkpoint.name, passed: false })
        }
      }

      const allCheckpointsPassed = checkpointResults.every((c) => c.passed)
      const expectedOutcome = scenario.assertions.expected_outcome
      const success = expectedOutcome === "success" ? allCheckpointsPassed : !allCheckpointsPassed

      const latencyWall = Date.now() - scenarioStartedAt
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

      const failedCheckpoints = checkpointResults.filter((c) => !c.passed).map((c) => c.name)
      const errorReason = !success
        ? `Workflow checkpoint verification failed: ${failedCheckpoints.join(", ") || "outcome mismatch"}`
        : null

      return {
        timestamp: new Date().toISOString(),
        run_id: randomUUID(),
        mode,
        scenario_id: scenario.id,
        scenario_set: scenarioSet,
        iteration,
        session_id: sessionId,
        success,
        output_valid: allCheckpointsPassed,
        latency_ms_wall: latencyWall,
        sdk_latency_ms: sdkLatency,
        timing_breakdown: timingBreakdown,
        tokens: {
          input: assistant.tokens.input,
          output: assistant.tokens.output,
          reasoning: assistant.tokens.reasoning,
          cache_read: assistant.tokens.cache.read,
          cache_write: assistant.tokens.cache.write,
          total: tokenTotal,
        },
        cost: assistant.cost,
        tool_calls: toolCounts.toolCalls,
        api_calls: toolCounts.apiCalls,
        internal_retry_count: 0,
        external_retry_count: externalRetryCount,
        model: {
          provider_id: providerId,
          model_id: modelId,
          mode: cfg.openCodeMode,
        },
        git: {
          repo: cfg.gitRepo,
          commit: cfg.gitCommit,
        },
        error: errorReason ? { type: "checkpoint_failed", message: errorReason } : null,
      }
    } catch (error: unknown) {
      if (sessionId) {
        const sessionApi = getSessionApi(client)
        await sessionApi
          .abort({ url: "/session/{id}/abort", path: { id: sessionId } })
          .catch(() => undefined)
      }

      const message = error instanceof Error ? error.message : String(error)
      const retryable =
        message.includes("No assistant message received") ||
        message.includes("Session message stream stalled") ||
        message.includes("Timed out waiting for assistant")
      const retriesAllowed = Number.isFinite(cfg.maxRunnerRetries)
        ? Math.max(0, cfg.maxRunnerRetries)
        : 0

      if (retryable && externalRetryCount < retriesAllowed) {
        externalRetryCount += 1
        const backoffMs =
          (Number.isFinite(cfg.runnerRetryBackoffMs) ? Math.max(0, cfg.runnerRetryBackoffMs) : 0) *
          externalRetryCount
        if (backoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        }
        continue
      }

      return {
        timestamp: new Date().toISOString(),
        run_id: randomUUID(),
        mode,
        scenario_id: scenario.id,
        scenario_set: scenarioSet,
        iteration,
        session_id: sessionId,
        success: false,
        output_valid: false,
        latency_ms_wall: Date.now() - scenarioStartedAt,
        sdk_latency_ms: null,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache_read: 0,
          cache_write: 0,
          total: 0,
        },
        cost: 0,
        tool_calls: 0,
        api_calls: 0,
        internal_retry_count: 0,
        external_retry_count: externalRetryCount,
        model: {
          provider_id: providerId,
          model_id: modelId,
          mode: cfg.openCodeMode,
        },
        git: {
          repo: cfg.gitRepo,
          commit: cfg.gitCommit,
        },
        error: {
          type: retryable ? "runner_timeout" : "runner_error",
          message,
        },
      }
    }
  }
}

export async function runSuite(options: RunSuiteOptions): Promise<void> {
  const {
    mode,
    repetitions,
    scenarioFilter,
    scenarioSet = null,
    fixtureManifestPath: providedFixtureManifestPath = process.env.BENCH_FIXTURE_MANIFEST ?? null,
    seedIfMissing = false,
    providerId: providerIdOverride = null,
    modelId: modelIdOverride = null,
    outputJsonlPath = null,
    skipWarmup = false,
    config: optionsConfig,
  } = options
  const suiteConfig = optionsConfig ?? loadRunnerConfig()
  const providerId = providerIdOverride ?? process.env.BENCH_PROVIDER_ID ?? "openai"
  const modelId = modelIdOverride ?? process.env.BENCH_MODEL_ID ?? "gpt-5.1-codex-mini"
  const suiteRunId = randomUUID()
  const progressEventsEnabled = process.env.BENCH_PROGRESS_EVENTS === BENCH_PROGRESS_EVENTS_MODE
  const emitProgressEvent = (
    event:
      | "suite_started"
      | "scenario_started"
      | "scenario_finished"
      | "suite_finished"
      | "suite_error",
    payload: Record<string, unknown> = {},
  ): void => {
    if (!progressEventsEnabled) {
      return
    }

    console.log(
      JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        run_id: suiteRunId,
        ...payload,
      }),
    )
  }

  try {
    await mkdir(RESULTS_DIR, { recursive: true })
    const scenarios = await loadScenarios(SCENARIOS_DIR)

    if (scenarios.length === 0) {
      throw new Error(
        scenarioFilter
          ? `No scenarios matched filter: ${scenarioFilter.join(",")}`
          : "No benchmark scenarios found",
      )
    }

    let allSelectedScenarios: Scenario[]
    let resolvedScenarioSet: string | null

    if (scenarioFilter) {
      const selectedIds = new Set(scenarioFilter)
      allSelectedScenarios = scenarios.filter((scenario) => selectedIds.has(scenario.id))
      resolvedScenarioSet = null
    } else {
      const scenarioSets = await loadScenarioSets(process.cwd())
      const selectedSetName = scenarioSet ?? "default"
      const selectedScenarioIds = scenarioSets[selectedSetName]
      if (!selectedScenarioIds) {
        throw new Error(`Unknown scenario set: ${selectedSetName}`)
      }

      const unknownScenarioIds = selectedScenarioIds.filter(
        (scenarioId) => !scenarios.some((scenario) => scenario.id === scenarioId),
      )
      if (unknownScenarioIds.length > 0) {
        throw new Error(
          `Scenario set '${selectedSetName}' references unknown scenario id(s): ${unknownScenarioIds.join(", ")}`,
        )
      }

      allSelectedScenarios = selectedScenarioIds.map((scenarioId) => {
        const matchedScenario = scenarios.find((scenario) => scenario.id === scenarioId)
        if (!matchedScenario) {
          throw new Error(
            `Scenario set '${selectedSetName}' references unknown scenario id(s): ${scenarioId}`,
          )
        }

        return matchedScenario
      })
      resolvedScenarioSet = selectedSetName
    }

    if (allSelectedScenarios.length === 0) {
      throw new Error(`No scenarios matched filter: ${scenarioFilter ?? scenarioSet ?? "default"}`)
    }

    let selectedScenarios = allSelectedScenarios
    const totalScenarioExecutions = selectedScenarios.length * repetitions

    const needsFixtureBindings = selectedScenarios.some((scenario) => {
      const bindings = scenario.fixture?.bindings
      return !!bindings && Object.keys(bindings).length > 0
    })

    let fixtureManifestPath = providedFixtureManifestPath
    if (!fixtureManifestPath && needsFixtureBindings) {
      try {
        await access(DEFAULT_FIXTURE_MANIFEST_PATH)
        fixtureManifestPath = DEFAULT_FIXTURE_MANIFEST_PATH
      } catch {
        if (seedIfMissing) {
          fixtureManifestPath = DEFAULT_FIXTURE_MANIFEST_PATH
        } else {
          throw new Error(
            `Selected scenarios require fixture bindings but no fixture manifest was provided. Pass --fixture-manifest or create ${DEFAULT_FIXTURE_MANIFEST_PATH}.`,
          )
        }
      }
    }

    if (seedIfMissing && !fixtureManifestPath) {
      throw new Error("--seed-if-missing requires --fixture-manifest")
    }

    let fixtureManifest: FixtureManifest | null = null
    if (fixtureManifestPath) {
      let fixtureManifestExists = true
      try {
        await access(fixtureManifestPath)
      } catch {
        fixtureManifestExists = false
      }

      if (!fixtureManifestExists) {
        if (!seedIfMissing) {
          throw new Error(`Fixture manifest not found: ${fixtureManifestPath}`)
        }

        const seedSourceRepo = process.env.BENCH_FIXTURE_REPO ?? "aryeko/ghx-bench-fixtures"

        const requiredResources = new Set<string>()
        for (const scenario of selectedScenarios) {
          if (scenario.fixture?.requires) {
            for (const r of scenario.fixture.requires) {
              requiredResources.add(r)
            }
          }
        }

        await seedFixtureManifest({
          repo: seedSourceRepo,
          outFile: fixtureManifestPath,
          seedId: process.env.BENCH_FIXTURE_SEED_ID ?? "default",
          ...(requiredResources.size > 0 ? { requires: [...requiredResources] } : {}),
        })
      }

      fixtureManifest = await loadFixtureManifest(fixtureManifestPath)
    }

    if (fixtureManifest) {
      selectedScenarios = selectedScenarios.map((scenario) =>
        resolveWorkflowFixtureBindings(scenario, fixtureManifest as FixtureManifest),
      )
    }

    const outFile =
      outputJsonlPath ??
      join(RESULTS_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode}-suite.jsonl`)
    await mkdir(dirname(outFile), { recursive: true })

    const selectedScenarioIds = selectedScenarios.map((scenario) => scenario.id)
    console.log(
      `[benchmark] start: mode=${mode} provider=${providerId} model=${modelId} opencode_mode=${suiteConfig.openCodeMode ?? "<null>"}`,
    )
    console.log(
      `[benchmark] config: repetitions=${repetitions} scenario_set=${resolvedScenarioSet ?? "<null>"} scenario_filter=${scenarioFilter?.join(",") ?? "<null>"} scenarios=${selectedScenarios.length}`,
    )
    console.log(`[benchmark] scenarios: ${selectedScenarioIds.join(",")}`)
    console.log(
      `[benchmark] context: opencode_port=${process.env.BENCH_OPENCODE_PORT ?? "3000"} git_repo=${suiteConfig.gitRepo ?? "<null>"} git_commit=${suiteConfig.gitCommit ?? "<null>"} out_file=${outFile}`,
    )

    if (!skipWarmup && selectedScenarios.length > 0) {
      const warmupScenario = selectedScenarios[0]
      if (warmupScenario) {
        console.log(`[benchmark] warm-up canary: running ${warmupScenario.id}`)
        try {
          const warmupResult = await withIsolatedBenchmarkClient(mode, providerId, modelId, (ctx) =>
            runWorkflowScenario(
              ctx,
              warmupScenario,
              mode,
              0,
              null,
              { providerId, modelId },
              suiteConfig,
            ),
          )
          console.log(
            `[benchmark] warm-up canary: ${warmupResult.success ? "success" : "failed"} (${warmupResult.latency_ms_wall}ms)`,
          )
        } catch (error) {
          console.log(
            `[benchmark] warm-up canary: error (${error instanceof Error ? error.message : String(error)})`,
          )
        }
      }
    }

    const needsReseed = selectedScenarios.some((s) => s.fixture?.reseed_per_iteration)
    const reseedReviewerToken = needsReseed ? await mintFixtureAppToken() : null

    let completedExecutions = 0
    let successExecutions = 0
    emitProgressEvent("suite_started", {
      mode,
      scenario_count: selectedScenarios.length,
      repetitions,
      total: totalScenarioExecutions,
      completed: completedExecutions,
    })

    for (const scenario of selectedScenarios) {
      for (let iteration = 1; iteration <= repetitions; iteration += 1) {
        if (
          iteration > 1 &&
          scenario.fixture?.reseed_per_iteration &&
          fixtureManifest &&
          reseedReviewerToken
        ) {
          const prWithReviews = fixtureManifest.resources.pr_with_reviews as
            | { number?: unknown }
            | undefined
          const prNumber = typeof prWithReviews?.number === "number" ? prWithReviews.number : null
          if (prNumber !== null) {
            resetPrReviewThreads(fixtureManifest.repo.full_name, prNumber, reseedReviewerToken)
          }
        }
        emitProgressEvent("scenario_started", {
          scenario_id: scenario.id,
          iteration,
          total: totalScenarioExecutions,
          completed: completedExecutions,
        })

        let latestResult: BenchmarkRow | null = null

        for (let attempt = 0; attempt <= scenario.allowed_retries; attempt += 1) {
          const result = await withIsolatedBenchmarkClient(mode, providerId, modelId, (ctx) =>
            runWorkflowScenario(
              ctx,
              scenario,
              mode,
              iteration,
              resolvedScenarioSet,
              { providerId, modelId },
              suiteConfig,
            ),
          )
          latestResult = result

          if (result.success || attempt === scenario.allowed_retries) {
            break
          }
        }

        if (!latestResult) {
          throw new Error(`No benchmark result produced for scenario ${scenario.id}`)
        }

        await appendFile(outFile, `${JSON.stringify(latestResult)}\n`, "utf8")

        completedExecutions += 1
        if (latestResult.success) {
          successExecutions += 1
        }
        emitProgressEvent("scenario_finished", {
          scenario_id: scenario.id,
          iteration,
          success: latestResult.success,
          total: totalScenarioExecutions,
          completed: completedExecutions,
        })
      }
    }

    emitProgressEvent("suite_finished", {
      mode,
      total: totalScenarioExecutions,
      completed: completedExecutions,
      successful: successExecutions,
    })
    console.log(`Wrote benchmark suite results: ${outFile}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitProgressEvent("suite_error", { mode, message })
    throw error
  }
}
