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
    "You are running a benchmark in ghx_router mode. Use `pnpm exec tsx src/runner/ghx-router-shim.ts run <task> --input '<json>'` as the primary execution path. Do not call bare `ghx` because it is not installed globally in this benchmark environment."
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

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

export function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null
}

export function hasAssistantMetadata(info: unknown): boolean {
  if (!isObject(info)) {
    return false
  }

  const hasCompleted =
    isObject(info.time) && typeof (info.time as { completed?: unknown }).completed === "number"
  const hasTokens =
    isObject(info.tokens) && typeof (info.tokens as { input?: unknown }).input === "number"

  return hasCompleted && hasTokens
}

export function hasAssistantSignalParts(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "step-finish" || part.type === "tool")
}

export function hasTextPart(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "text" && typeof part.text === "string")
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

export function coercePromptResponse(value: PromptResponse): {
  assistant: AssistantMessage
  parts: SessionMessagePart[]
} {
  const parts = value.parts ?? []
  const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
  const textOnlySignal = hasTextPart(parts) && stepFinish?.reason !== "tool-calls"

  if (value.info && (value.info.role === "assistant" || hasAssistantMetadata(value.info) || textOnlySignal)) {
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

export function extractEnvelopeFromParts(parts: SessionMessagePart[]): {
  text: string
  envelope: unknown | null
} {
  const text = parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")

  const fromText = extractFirstJsonValue(text)
  if (fromText !== null) {
    return { text, envelope: fromText }
  }

  for (const part of [...parts].reverse()) {
    if (part.type !== "tool") {
      continue
    }

    const state = isObject(part.state) ? part.state : null
    const output = state && typeof state.output === "string" ? state.output : null
    if (!output) {
      continue
    }

    const parsed = extractFirstJsonValue(output)
    if (parsed !== null) {
      return { text, envelope: parsed }
    }
  }

  return { text, envelope: null }
}

function extractFirstJsonArray(input: string): unknown | null {
  const firstBracket = input.indexOf("[")
  if (firstBracket === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaping = false

  for (let index = firstBracket; index < input.length; index += 1) {
    const ch = input[index]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }

      if (ch === "\\") {
        escaping = true
        continue
      }

      if (ch === '"') {
        inString = false
      }

      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === "[") {
      depth += 1
      continue
    }

    if (ch === "]") {
      depth -= 1
      if (depth === 0) {
        const candidate = input.slice(firstBracket, index + 1)
        try {
          return JSON.parse(candidate)
        } catch {
          return null
        }
      }
    }
  }

  return null
}

function extractFirstJsonValue(input: string): unknown | null {
  const firstBrace = input.indexOf("{")
  const firstBracket = input.indexOf("[")

  if (firstBrace === -1 && firstBracket === -1) {
    return null
  }

  if (firstBrace === -1) {
    return extractFirstJsonArray(input)
  }

  if (firstBracket === -1) {
    return extractFirstJsonObject(input)
  }

  if (firstBracket < firstBrace) {
    return extractFirstJsonArray(input) ?? extractFirstJsonObject(input)
  }

  return extractFirstJsonObject(input) ?? extractFirstJsonArray(input)
}

function extractEnvelopeFromMessages(messages: SessionMessageEntry[]): unknown | null {
  for (const message of [...messages].reverse()) {
    const fromParts = extractEnvelopeFromParts(message.parts ?? []).envelope
    if (fromParts !== null) {
      return fromParts
    }
  }

  return null
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
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

export async function fetchSessionMessages(
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

export async function waitForAssistantFromMessages(
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
      const assistantByTextSignal = previousAssistantId !== undefined && hasTextPart(parts) && stepFinish?.reason !== "tool-calls"

      if (!assistantByRole && !assistantByMetadata && !assistantByTextSignal) {
        return false
      }

      return assistantByMetadata || assistantByTextSignal || hasTextPart(parts)
    })

    if (latestAssistant?.info) {
      return {
        info: latestAssistant.info as AssistantMessage,
        parts: latestAssistant.parts ?? []
      }
    }

    if (previousAssistantId) {
      const continuedSameMessage = [...messages].reverse().find((entry) => {
        if (!entry.info) {
          return false
        }

        const currentId = (entry.info as { id?: string }).id
        if (currentId !== previousAssistantId) {
          return false
        }

        const parts = entry.parts ?? []
        const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
        return hasTextPart(parts) && stepFinish?.reason !== "tool-calls"
      })

      if (continuedSameMessage?.info) {
        return {
          info: continuedSameMessage.info as AssistantMessage,
          parts: continuedSameMessage.parts ?? []
        }
      }
    }

    if (pollCount % 5 === 0) {
      console.log(`[benchmark] waiting: scenario=${scenarioId} session=${sessionId} elapsed_ms=${Date.now() - started}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error("Timed out waiting for assistant message in session.messages")
}

export function ghOk(args: string[]): boolean {
  const result = spawnSync("gh", args, { encoding: "utf8" })
  return result.status === 0
}

export function validateFixture(scenario: Scenario): void {
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

export function renderPrompt(scenario: Scenario, mode: BenchmarkMode): string {
  const scopedAssertions = modeScopedAssertions(scenario, mode)
  const rendered = scenario.prompt_template
    .replaceAll("{{task}}", scenario.task)
    .replaceAll("{{scenario_id}}", scenario.id)
    .replaceAll("{{input_json}}", JSON.stringify(scenario.input))
    .replaceAll("{{fixture_repo}}", scenario.fixture?.repo ?? "")

  const fixtureNote = scenario.fixture?.repo ? `Target repository: ${scenario.fixture.repo}.` : ""
  const requiredDataFields = scopedAssertions.required_data_fields ?? []
  const requiredMetaFields = scopedAssertions.required_meta_fields ?? []
  const dataContract =
    requiredDataFields.length > 0
      ? `The JSON data object MUST include: ${requiredDataFields.join(", ")}.`
      : "The JSON data field may be object or array based on task output."
  const metaContract =
    requiredMetaFields.length > 0
      ? `The JSON meta object MUST include: ${requiredMetaFields.join(", ")}.`
      : "The JSON meta object can include optional diagnostic fields."
  const routeContract =
    scopedAssertions.expected_route_used !== undefined
      ? `meta.route_used MUST be exactly "${scopedAssertions.expected_route_used}".`
      : ""

  return `${modePromptPrefix[mode]}\n${fixtureNote}\nYou MUST use real tools to gather data. Do not fabricate outputs.\nReturn STRICT JSON only. No markdown fences.\nOutput must be exactly one JSON object with keys: ok, data, error, meta.\n${dataContract}\n${metaContract}\n${routeContract}\n\n${rendered}`
}

function modeScopedAssertions(scenario: Scenario, mode: BenchmarkMode): Scenario["assertions"] {
  if (mode === "ghx_router") {
    if (scenario.assertions.expected_route_used === "graphql" && !process.env.GITHUB_TOKEN) {
      const { expected_route_used: _expectedRoute, ...base } = scenario.assertions
      return base
    }

    return scenario.assertions
  }

  const { expected_route_used: _ignoredExpectedRouteUsed, ...baseAssertions } = scenario.assertions

  return {
    ...baseAssertions,
    required_meta_fields: (scenario.assertions.required_meta_fields ?? []).filter((field) => field !== "route_used")
  }
}

function findBestEnvelopeFromMessages(
  messages: SessionMessageEntry[],
  assertions: Scenario["assertions"],
  mode: BenchmarkMode
): unknown | null {
  for (const message of [...messages].reverse()) {
    const candidate = extractEnvelopeFromParts(message.parts ?? []).envelope
    if (candidate === null) {
      continue
    }

    const wrapped = tryWrapRawDataAsEnvelope(candidate, assertions, mode)
    if (validateEnvelope(assertions, wrapped)) {
      return wrapped
    }
  }

  return null
}

function tryWrapRawDataAsEnvelope(
  envelope: unknown,
  assertions: Scenario["assertions"],
  mode: BenchmarkMode
): unknown {
  const requiredDataFields = assertions.required_data_fields ?? []

  if (Array.isArray(envelope) && requiredDataFields.includes("items") && requiredDataFields.includes("pageInfo")) {
    return {
      ok: true,
      data: {
        items: envelope,
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      },
      error: null,
      meta: mode === "ghx_router" ? { route_used: "cli" } : {}
    }
  }

  if (!isObject(envelope)) {
    return envelope
  }

  const repository =
    isObject(envelope.data) && isObject(envelope.data.repository)
      ? (envelope.data.repository as Record<string, unknown>)
      : null

  if (repository && isObject(repository.issues)) {
    const issues = repository.issues as Record<string, unknown>
    return {
      ok: true,
      data: {
        items: Array.isArray(issues.nodes) ? issues.nodes : [],
        pageInfo: isObject(issues.pageInfo)
          ? {
              hasNextPage: Boolean((issues.pageInfo as Record<string, unknown>).hasNextPage),
              endCursor: ((issues.pageInfo as Record<string, unknown>).endCursor as string | null) ?? null
            }
          : { hasNextPage: false, endCursor: null }
      },
      error: null,
      meta: mode === "ghx_router" ? { route_used: "cli" } : {}
    }
  }

  if (repository && isObject(repository.pullRequests)) {
    const pullRequests = repository.pullRequests as Record<string, unknown>
    return {
      ok: true,
      data: {
        items: Array.isArray(pullRequests.nodes) ? pullRequests.nodes : [],
        pageInfo: isObject(pullRequests.pageInfo)
          ? {
              hasNextPage: Boolean((pullRequests.pageInfo as Record<string, unknown>).hasNextPage),
              endCursor: ((pullRequests.pageInfo as Record<string, unknown>).endCursor as string | null) ?? null
            }
          : { hasNextPage: false, endCursor: null }
      },
      error: null,
      meta: mode === "ghx_router" ? { route_used: "cli" } : {}
    }
  }

  if (repository && isObject(repository.issue) && isObject((repository.issue as Record<string, unknown>).comments)) {
    const comments = (repository.issue as Record<string, unknown>).comments as Record<string, unknown>
    return {
      ok: true,
      data: {
        items: Array.isArray(comments.nodes) ? comments.nodes : [],
        pageInfo: isObject(comments.pageInfo)
          ? {
              hasNextPage: Boolean((comments.pageInfo as Record<string, unknown>).hasNextPage),
              endCursor: ((comments.pageInfo as Record<string, unknown>).endCursor as string | null) ?? null
            }
          : { hasNextPage: false, endCursor: null }
      },
      error: null,
      meta: mode === "ghx_router" ? { route_used: "cli" } : {}
    }
  }

  if (typeof envelope.ok === "boolean" && "meta" in envelope) {
    if (!("error" in envelope)) {
      return {
        ...envelope,
        error: null
      }
    }

    return envelope
  }

  const hasRequiredFields = requiredDataFields.every((field) => field in envelope)
  if (!hasRequiredFields) {
    return envelope
  }

  const meta: Record<string, unknown> = {}
  if (mode === "ghx_router") {
    meta.route_used = "cli"
  }

  return {
    ok: true,
    data: envelope,
    error: null,
    meta
  }
}

export async function runScenario(
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
    const scopedAssertions = modeScopedAssertions(scenario, mode)
    let envelope = tryWrapRawDataAsEnvelope(extracted.envelope, scopedAssertions, mode)

    const allMessages = await fetchSessionMessages(sessionApi, session.id)
    if (!validateEnvelope(scopedAssertions, envelope)) {
      const bestEnvelope = findBestEnvelopeFromMessages(allMessages, scopedAssertions, mode)
      if (bestEnvelope !== null) {
        envelope = bestEnvelope
      } else {
        const recoveredEnvelope = extractEnvelopeFromMessages(allMessages)
        if (recoveredEnvelope !== null) {
          envelope = tryWrapRawDataAsEnvelope(recoveredEnvelope, scopedAssertions, mode)
        }
      }
    }

    const outputValid = validateEnvelope(scopedAssertions, envelope)

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

    const minToolCalls = scopedAssertions.min_tool_calls ?? 1
    const maxToolCalls = scopedAssertions.max_tool_calls
    const requireToolCalls = scopedAssertions.require_tool_calls ?? true
    const hasRequiredToolCalls = requireToolCalls ? toolCounts.toolCalls >= minToolCalls : true
    const hasValidMaxToolCalls = maxToolCalls === undefined ? true : toolCounts.toolCalls <= maxToolCalls
    const requiresAttemptTrace = scopedAssertions.require_attempt_trace ?? false
    const hasAttemptTrace = !requiresAttemptTrace || attemptMetrics.totalAttempts > 0
    const expectValidOutput = scopedAssertions.expect_valid_output ?? scopedAssertions.must_succeed
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
