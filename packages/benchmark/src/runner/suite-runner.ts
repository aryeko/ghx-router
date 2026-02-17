import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { lstatSync } from "node:fs"
import { access, appendFile, lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createOpencode } from "@opencode-ai/sdk"
import type {
  BenchmarkMode,
  BenchmarkRow,
  BenchmarkTimingBreakdown,
  FixtureManifest,
  Scenario,
  SessionMessageEntry,
  SessionMessagePart,
} from "../domain/types.js"
import { extractAttemptMetrics } from "../extract/attempts.js"
import { extractFirstJsonObject, validateEnvelope } from "../extract/envelope.js"
import { aggregateToolCounts } from "../extract/tool-usage.js"
import { loadFixtureManifest, resolveScenarioFixtureBindings } from "../fixture/manifest.js"
import { seedFixtureManifest } from "../fixture/seed.js"
import { loadScenarioSets, loadScenarios } from "../scenario/loader.js"
import {
  AGENT_DIRECT_INSTRUCTION,
  MCP_INSTRUCTION,
  modeInstructions,
} from "./mode/mode-instructions.js"
import { validateFixture } from "./preflight/fixture-preflight.js"
import * as ghxRouterPreflight from "./preflight/ghx-router-preflight.js"
import {
  buildOutputSchema,
  forcedToolCommandHint,
  modeScopedAssertions,
  renderPrompt,
} from "./prompt/prompt-renderer.js"

type RunSuiteOptions = {
  mode: BenchmarkMode
  repetitions: number
  scenarioFilter: string | null
  scenarioSet?: string | null
  fixtureManifestPath?: string | null
  seedIfMissing?: boolean
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

const PROVIDER_ID = process.env.BENCH_PROVIDER_ID ?? "openai"
const MODEL_ID = process.env.BENCH_MODEL_ID ?? "gpt-5.3-codex"
const OPEN_CODE_MODE = process.env.BENCH_OPENCODE_MODE ?? null
const GIT_REPO = process.env.BENCH_GIT_REPO ?? null
const GIT_COMMIT = process.env.BENCH_GIT_COMMIT ?? null
const OPENCODE_PORT = Number.parseInt(process.env.BENCH_OPENCODE_PORT ?? "3000", 10)
const FIRST_ASSISTANT_TIMEOUT_MS = Number.parseInt(
  process.env.BENCH_FIRST_ASSISTANT_TIMEOUT_MS ?? "15000",
  10,
)
const SESSION_STALL_TIMEOUT_MS = Number.parseInt(
  process.env.BENCH_SESSION_STALL_TIMEOUT_MS ?? "10000",
  10,
)
const MAX_RUNNER_RETRIES = Number.parseInt(process.env.BENCH_RUNNER_MAX_RETRIES ?? "1", 10)
const RUNNER_RETRY_BACKOFF_MS = Number.parseInt(
  process.env.BENCH_RUNNER_RETRY_BACKOFF_MS ?? "750",
  10,
)
const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url))
const BENCHMARK_PACKAGE_ROOT = resolve(MODULE_DIR, "..", "..")
const BENCHMARK_BIN_DIR = join(BENCHMARK_PACKAGE_ROOT, "bin")
const GHX_BENCHMARK_ALIAS_PATH = join(BENCHMARK_BIN_DIR, "ghx")
const GHX_SKILL_ASSET_PATH = resolve(
  BENCHMARK_PACKAGE_ROOT,
  "../core/src/cli/assets/skills/ghx/SKILL.md",
)

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

function hasStructuredOutput(info: unknown): boolean {
  if (!isObject(info)) {
    return false
  }

  const structuredOutput = (info as { structured_output?: unknown }).structured_output
  const structured = (info as { structured?: unknown }).structured

  return structuredOutput !== undefined || structured !== undefined
}

export function hasAssistantSignalParts(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "step-finish" || part.type === "tool")
}

export function hasTextPart(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "text" && typeof part.text === "string")
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

function hasAssistantSignal(entry: SessionMessageEntry): boolean {
  if (!entry.info) {
    return false
  }

  return (
    hasAssistantMetadata(entry.info) ||
    hasStructuredOutput(entry.info) ||
    (entry.info as { role?: unknown }).role === "assistant"
  )
}

function messageProgressSignature(messages: SessionMessageEntry[]): string {
  return messages
    .map((entry) => {
      const info = entry.info as { id?: unknown; role?: unknown } | undefined
      const id = typeof info?.id === "string" ? info.id : "<no-id>"
      const role = typeof info?.role === "string" ? info.role : "<no-role>"
      const parts = entry.parts ?? []
      const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
      const stepReason = typeof stepFinish?.reason === "string" ? stepFinish.reason : "<none>"
      return `${id}:${role}:${parts.length}:${stepReason}`
    })
    .join("|")
}

export async function waitForAssistantFromMessages(
  sessionApi: ReturnType<typeof getSessionApi>,
  sessionId: string,
  timeoutMs: number,
  scenarioId: string,
  previousAssistantId?: string,
): Promise<PromptResponse> {
  const started = Date.now()
  let lastWaitLogAt = started
  let lastProgressAt = started
  let lastSignature = ""
  const firstAssistantBudgetMs = Math.min(
    timeoutMs,
    Number.isFinite(FIRST_ASSISTANT_TIMEOUT_MS) && FIRST_ASSISTANT_TIMEOUT_MS > 0
      ? FIRST_ASSISTANT_TIMEOUT_MS
      : timeoutMs,
  )
  const stallBudgetMs = Math.min(
    timeoutMs,
    Number.isFinite(SESSION_STALL_TIMEOUT_MS) && SESSION_STALL_TIMEOUT_MS > 0
      ? SESSION_STALL_TIMEOUT_MS
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
      const hasEnvelopeCandidate = extractEnvelopeFromParts(parts).envelope !== null
      const assistantByRole = role === "assistant"
      const assistantByMetadata = hasAssistantMetadata(entry.info)
      const assistantWithStructuredOutput = hasStructuredOutput(entry.info)
      const assistantByRoleTextSignal =
        assistantByRole &&
        hasTextPart(parts) &&
        stepFinish?.reason !== "tool-calls" &&
        hasEnvelopeCandidate
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

      if (
        !assistantByRole &&
        !assistantByMetadata &&
        !assistantByTextSignal &&
        !assistantByRoleTextSignal
      ) {
        return false
      }

      return isCompletedAssistant || assistantByTextSignal || assistantByRoleTextSignal
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
        const hasEnvelopeCandidate = extractEnvelopeFromParts(parts).envelope !== null
        const role = (entry.info as { role?: unknown }).role
        const assistantByRole = role === "assistant"
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
          (hasTextPart(parts) && hasCompletedStep) ||
          (assistantByRole &&
            hasTextPart(parts) &&
            stepFinish?.reason !== "tool-calls" &&
            hasEnvelopeCandidate)
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

async function ensureBenchmarkGhxAliasReady(): Promise<void> {
  try {
    await lstat(GHX_BENCHMARK_ALIAS_PATH)
  } catch {
    throw new Error(
      "ghx_preflight_failed: benchmark ghx alias missing; run pnpm --filter @ghx-dev/core run build and ensure packages/benchmark/bin/ghx points to packages/core/dist/cli/index.js",
    )
  }
}

function assertBenchmarkGhxAliasReady(): void {
  try {
    lstatSync(GHX_BENCHMARK_ALIAS_PATH)
  } catch {
    throw new Error(
      "ghx_preflight_failed: benchmark ghx alias missing; run pnpm --filter @ghx-dev/core run build and ensure packages/benchmark/bin/ghx points to packages/core/dist/cli/index.js",
    )
  }
}

export function assertGhxRouterPreflight(scenarios: Scenario[]): void {
  ghxRouterPreflight.assertGhxRouterPreflight(scenarios, {
    ghxCommand: GHX_BENCHMARK_ALIAS_PATH,
    ensureGhxAliasReady: assertBenchmarkGhxAliasReady,
  })
}

async function loadGhxSkillInstruction(): Promise<string> {
  return readFile(GHX_SKILL_ASSET_PATH, "utf8")
}

function resolveGhTokenFromCli(): string | null {
  const result = spawnSync("gh", ["auth", "token"], { encoding: "utf8" })
  if (result.status !== 0) {
    return null
  }

  const token = typeof result.stdout === "string" ? result.stdout.trim() : ""
  return token.length > 0 ? token : null
}

async function withIsolatedBenchmarkClient<T>(
  mode: BenchmarkMode,
  run: (client: unknown) => Promise<T>,
): Promise<T> {
  const isolatedXdgConfigHome = await mkdtemp(join(tmpdir(), "ghx-benchmark-opencode-"))
  const instructions = await modeInstructions(mode, loadGhxSkillInstruction)
  if (mode === "ghx") {
    await ensureBenchmarkGhxAliasReady()
  }

  const previousEnv = {
    OPENCODE_CONFIG: process.env.OPENCODE_CONFIG,
    OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    GH_TOKEN: process.env.GH_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    PATH: process.env.PATH,
  }

  const ghToken = previousEnv.GH_TOKEN ?? previousEnv.GITHUB_TOKEN ?? resolveGhTokenFromCli()

  delete process.env.OPENCODE_CONFIG
  delete process.env.OPENCODE_CONFIG_DIR
  process.env.XDG_CONFIG_HOME = isolatedXdgConfigHome
  if (ghToken) {
    process.env.GH_TOKEN = ghToken
    process.env.GITHUB_TOKEN = ghToken
  }
  if (mode === "ghx") {
    process.env.PATH =
      previousEnv.PATH && previousEnv.PATH.length > 0
        ? `${BENCHMARK_BIN_DIR}${delimiter}${previousEnv.PATH}`
        : BENCHMARK_BIN_DIR
  }

  let server: { close: () => void } | null = null

  try {
    const opencode = await createOpencode({
      port: Number.isInteger(OPENCODE_PORT) && OPENCODE_PORT > 0 ? OPENCODE_PORT : 3000,
      config: {
        model: `${PROVIDER_ID}/${MODEL_ID}`,
        instructions,
        plugin: [],
        mcp: {},
        agent: {},
        command: {},
        permission: {
          edit: "deny",
          bash: "allow",
          webfetch: "allow",
          doom_loop: "deny",
          external_directory: "deny",
        },
      },
    })

    server = opencode.server
    const client = opencode.client

    const configApi = (
      client as {
        config?: { get?: (args?: Record<string, unknown>) => Promise<unknown> }
      }
    ).config
    if (configApi?.get) {
      const configResponse = await configApi.get({ url: "/config" })
      const resolvedConfig = unwrapData<Record<string, unknown>>(configResponse, "config.get")
      const configuredInstructions = Array.isArray(resolvedConfig.instructions)
        ? resolvedConfig.instructions
        : []
      const configuredPlugins = Array.isArray(resolvedConfig.plugin) ? resolvedConfig.plugin : []

      if (mode === "ghx") {
        const hasGhxInstructions = configuredInstructions.some(
          (instruction) => typeof instruction === "string" && instruction.trim().length > 0,
        )

        if (!hasGhxInstructions || configuredPlugins.length > 0) {
          throw new Error(
            `benchmark_config_invalid: expected non-empty ghx instructions and no plugins, got instructions=${configuredInstructions.length}, plugins=${configuredPlugins.length}`,
          )
        }
      } else {
        const expectedInstruction =
          mode === "agent_direct" ? AGENT_DIRECT_INSTRUCTION : MCP_INSTRUCTION
        const hasExpectedInstruction = configuredInstructions.some(
          (instruction) => instruction === expectedInstruction,
        )

        if (!hasExpectedInstruction || configuredPlugins.length > 0) {
          throw new Error(
            `benchmark_config_invalid: expected ${mode} instruction and no plugins, got instructions=${configuredInstructions.length}, plugins=${configuredPlugins.length}`,
          )
        }
      }
    }

    return await run(client)
  } finally {
    if (server) {
      server.close()
    }

    if (previousEnv.OPENCODE_CONFIG === undefined) {
      delete process.env.OPENCODE_CONFIG
    } else {
      process.env.OPENCODE_CONFIG = previousEnv.OPENCODE_CONFIG
    }

    if (previousEnv.OPENCODE_CONFIG_DIR === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR
    } else {
      process.env.OPENCODE_CONFIG_DIR = previousEnv.OPENCODE_CONFIG_DIR
    }

    if (previousEnv.XDG_CONFIG_HOME === undefined) {
      delete process.env.XDG_CONFIG_HOME
    } else {
      process.env.XDG_CONFIG_HOME = previousEnv.XDG_CONFIG_HOME
    }

    if (previousEnv.GH_TOKEN === undefined) {
      delete process.env.GH_TOKEN
    } else {
      process.env.GH_TOKEN = previousEnv.GH_TOKEN
    }

    if (previousEnv.GITHUB_TOKEN === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = previousEnv.GITHUB_TOKEN
    }

    if (previousEnv.PATH === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = previousEnv.PATH
    }

    await rm(isolatedXdgConfigHome, { recursive: true, force: true })
  }
}

function expectedOutcomeFromAssertions(
  assertions: Scenario["assertions"],
): "success" | "expected_error" {
  if (assertions.expected_outcome !== undefined) {
    return assertions.expected_outcome
  }

  return assertions.must_succeed === false ? "expected_error" : "success"
}

function matchesExpectedOutcome(
  envelope: unknown,
  expectedOutcome: "success" | "expected_error",
): boolean {
  if (!isObject(envelope)) {
    return false
  }

  const ok = envelope.ok === true
  const error = envelope.error

  if (expectedOutcome === "expected_error") {
    return isObject(error)
  }

  return ok && error === null
}

function findBestEnvelopeFromMessages(
  messages: SessionMessageEntry[],
  assertions: Scenario["assertions"],
  mode: BenchmarkMode,
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
  mode: BenchmarkMode,
): unknown {
  const requiredDataFields = assertions.required_data_fields ?? []

  if (
    Array.isArray(envelope) &&
    requiredDataFields.includes("items") &&
    requiredDataFields.includes("pageInfo")
  ) {
    return {
      ok: true,
      data: {
        items: envelope,
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
      error: null,
      meta: mode === "ghx" ? { route_used: "cli" } : {},
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
              endCursor:
                ((issues.pageInfo as Record<string, unknown>).endCursor as string | null) ?? null,
            }
          : { hasNextPage: false, endCursor: null },
      },
      error: null,
      meta: mode === "ghx" ? { route_used: "cli" } : {},
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
              endCursor:
                ((pullRequests.pageInfo as Record<string, unknown>).endCursor as string | null) ??
                null,
            }
          : { hasNextPage: false, endCursor: null },
      },
      error: null,
      meta: mode === "ghx" ? { route_used: "cli" } : {},
    }
  }

  if (
    repository &&
    isObject(repository.issue) &&
    isObject((repository.issue as Record<string, unknown>).comments)
  ) {
    const comments = (repository.issue as Record<string, unknown>).comments as Record<
      string,
      unknown
    >
    return {
      ok: true,
      data: {
        items: Array.isArray(comments.nodes) ? comments.nodes : [],
        pageInfo: isObject(comments.pageInfo)
          ? {
              hasNextPage: Boolean((comments.pageInfo as Record<string, unknown>).hasNextPage),
              endCursor:
                ((comments.pageInfo as Record<string, unknown>).endCursor as string | null) ?? null,
            }
          : { hasNextPage: false, endCursor: null },
      },
      error: null,
      meta: mode === "ghx" ? { route_used: "cli" } : {},
    }
  }

  if (typeof envelope.ok === "boolean") {
    const nextEnvelope: Record<string, unknown> = { ...envelope }

    if (!("meta" in nextEnvelope) || !isObject(nextEnvelope.meta)) {
      nextEnvelope.meta = mode === "ghx" ? { route_used: "cli" } : {}
    }

    if (!("error" in nextEnvelope)) {
      nextEnvelope.error = null
    }

    if (!("data" in nextEnvelope)) {
      nextEnvelope.data = {}
    }

    return nextEnvelope
  }

  const hasRequiredFields = requiredDataFields.every((field) => field in envelope)
  if (!hasRequiredFields) {
    return envelope
  }

  const meta: Record<string, unknown> = {}
  if (mode === "ghx") {
    meta.route_used = "cli"
  }

  return {
    ok: true,
    data: envelope,
    error: null,
    meta,
  }
}

export async function runScenario(
  client: unknown,
  scenario: Scenario,
  mode: BenchmarkMode,
  iteration: number,
  scenarioSet: string | null = null,
): Promise<BenchmarkRow> {
  const scenarioStartedAt = Date.now()
  let externalRetryCount = 0

  const classifyRunnerFailure = (
    error: unknown,
  ): { type: string; message: string; retryable: boolean } => {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("No assistant message received in session.messages")) {
      return { type: "runner_timeout_no_first_assistant", message, retryable: true }
    }

    if (message.includes("Session message stream stalled in session.messages")) {
      return { type: "runner_timeout_stalled_session", message, retryable: true }
    }

    if (message.includes("Timed out waiting for assistant message in session.messages")) {
      return { type: "runner_timeout_wait_for_assistant", message, retryable: true }
    }

    return { type: "runner_error", message, retryable: false }
  }

  while (true) {
    const attemptStartedAt = Date.now()
    let sessionId: string | null = null

    try {
      const sessionApi = getSessionApi(client)
      const scopedAssertions = modeScopedAssertions(scenario, mode)
      const benchmarkNonce = randomUUID()
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
            model: { providerID: PROVIDER_ID, modelID: MODEL_ID },
            agent: OPEN_CODE_MODE ?? undefined,
            parts: [
              {
                type: "text",
                text: renderPrompt(scenario, mode, benchmarkNonce),
              },
            ],
            format: {
              type: "json_schema",
              retryCount: 2,
              schema: buildOutputSchema(scopedAssertions),
            },
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
        ))
      let assistantAndParts = coercePromptResponse(hydrated)

      let extracted = extractEnvelopeFromParts(assistantAndParts.parts)
      if (
        extracted.envelope === null &&
        assistantAndParts.assistant.structured_output !== undefined
      ) {
        extracted = {
          ...extracted,
          envelope: assistantAndParts.assistant.structured_output,
        }
      }

      let continuationCount = 0
      while (extracted.envelope === null && continuationCount < 3) {
        continuationCount += 1
        const remaining = Math.max(1000, scenario.timeout_ms - (Date.now() - attemptStartedAt))

        const continuationResult = await withTimeout(
          sessionApi.promptAsync({
            url: "/session/{id}/prompt_async",
            path: { id: session.id },
            body: {
              messageID: assistantAndParts.assistant.id,
              model: { providerID: PROVIDER_ID, modelID: MODEL_ID },
              agent: OPEN_CODE_MODE ?? undefined,
              parts: [
                {
                  type: "text",
                  text: "Continue and return only one complete JSON object for the final envelope.",
                },
              ],
            },
          }),
          Math.min(10000, remaining),
          "session.promptAsync.continue",
        )

        const immediateContinuation = extractPromptResponseFromPromptResult(continuationResult)
        const next =
          immediateContinuation ??
          (await waitForAssistantFromMessages(
            sessionApi,
            session.id,
            remaining,
            scenario.id,
            assistantAndParts.assistant.id,
          ))

        assistantAndParts = coercePromptResponse(next)
        extracted = extractEnvelopeFromParts(assistantAndParts.parts)
      }

      let assistant = assistantAndParts.assistant
      let envelope = tryWrapRawDataAsEnvelope(extracted.envelope, scopedAssertions, mode)

      let allMessages = await fetchSessionMessages(sessionApi, session.id)
      let toolCounts = aggregateToolCounts(allMessages)
      const requireToolCalls = scopedAssertions.require_tool_calls ?? true

      let forceToolAttempt = 0
      while (requireToolCalls && toolCounts.toolCalls === 0 && forceToolAttempt < 3) {
        forceToolAttempt += 1
        const remaining = Math.max(1000, scenario.timeout_ms - (Date.now() - attemptStartedAt))
        const forcedCommand = forcedToolCommandHint(scenario, mode)
        const forcedPromptResult = await withTimeout(
          sessionApi.promptAsync({
            url: "/session/{id}/prompt_async",
            path: { id: session.id },
            body: {
              model: { providerID: PROVIDER_ID, modelID: MODEL_ID },
              agent: OPEN_CODE_MODE ?? undefined,
              parts: [
                {
                  type: "text",
                  text: `You must execute at least one real tool call before producing the final JSON envelope. Run this exact command now: ${forcedCommand}. Then return the final envelope JSON only.`,
                },
              ],
              format: {
                type: "json_schema",
                retryCount: 2,
                schema: buildOutputSchema(scopedAssertions),
              },
            },
          }),
          Math.min(10000, remaining),
          "session.promptAsync.tool-required",
        )

        const immediateForcedResponse = extractPromptResponseFromPromptResult(forcedPromptResult)
        const next =
          immediateForcedResponse ??
          (await waitForAssistantFromMessages(
            sessionApi,
            session.id,
            remaining,
            scenario.id,
            assistant.id,
          ))

        assistantAndParts = coercePromptResponse(next)
        assistant = assistantAndParts.assistant
        extracted = extractEnvelopeFromParts(assistantAndParts.parts)
        if (
          extracted.envelope === null &&
          assistantAndParts.assistant.structured_output !== undefined
        ) {
          extracted = {
            ...extracted,
            envelope: assistantAndParts.assistant.structured_output,
          }
        }

        envelope = tryWrapRawDataAsEnvelope(extracted.envelope, scopedAssertions, mode)
        allMessages = await fetchSessionMessages(sessionApi, session.id)
        toolCounts = aggregateToolCounts(allMessages)
      }

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

      const attemptMetrics = extractAttemptMetrics(envelope)
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
      const timingBreakdown = extractTimingBreakdown(allMessages)

      const minToolCalls = scopedAssertions.min_tool_calls ?? 1
      const maxToolCalls = scopedAssertions.max_tool_calls
      const hasRequiredToolCalls = requireToolCalls ? toolCounts.toolCalls >= minToolCalls : true
      const hasValidMaxToolCalls =
        maxToolCalls === undefined ? true : toolCounts.toolCalls <= maxToolCalls
      const requiresAttemptTrace = scopedAssertions.require_attempt_trace ?? false
      const hasAttemptTrace = !requiresAttemptTrace || attemptMetrics.totalAttempts > 0
      const expectedOutcome = expectedOutcomeFromAssertions(scopedAssertions)
      const expectValidOutput = scopedAssertions.expect_valid_output ?? true
      const outputExpectationMet = expectValidOutput ? outputValid : !outputValid
      const outcomeMatched = matchesExpectedOutcome(envelope, expectedOutcome)
      const errorReason = !outputExpectationMet
        ? `Output validation failed: outputValid=${outputValid}, expectValidOutput=${expectValidOutput}`
        : !outcomeMatched
          ? `Outcome validation failed: expected_outcome=${expectedOutcome}`
          : !hasRequiredToolCalls
            ? `Expected at least ${minToolCalls} tool call(s), got ${toolCounts.toolCalls}`
            : !hasValidMaxToolCalls
              ? `Expected at most ${maxToolCalls} tool call(s), got ${toolCounts.toolCalls}`
              : !hasAttemptTrace
                ? "Expected attempt trace metadata in output envelope"
                : null

      const success =
        outputExpectationMet &&
        outcomeMatched &&
        hasRequiredToolCalls &&
        hasValidMaxToolCalls &&
        hasAttemptTrace

      return {
        timestamp: new Date().toISOString(),
        run_id: randomUUID(),
        mode,
        scenario_id: scenario.id,
        scenario_set: scenarioSet,
        iteration,
        session_id: sessionId,
        success,
        output_valid: outputValid,
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
        internal_retry_count: attemptMetrics.retryCount,
        external_retry_count: externalRetryCount,
        model: {
          provider_id: PROVIDER_ID,
          model_id: MODEL_ID,
          mode: OPEN_CODE_MODE,
        },
        git: {
          repo: GIT_REPO,
          commit: GIT_COMMIT,
        },
        error: errorReason
          ? {
              type: "assertion_failed",
              message: errorReason,
            }
          : null,
      }
    } catch (error: unknown) {
      if (sessionId) {
        const sessionApi = getSessionApi(client)
        await sessionApi
          .abort({ url: "/session/{id}/abort", path: { id: sessionId } })
          .catch(() => undefined)
      }

      const failure = classifyRunnerFailure(error)
      const retriesAllowed = Number.isFinite(MAX_RUNNER_RETRIES)
        ? Math.max(0, MAX_RUNNER_RETRIES)
        : 0

      if (failure.retryable && externalRetryCount < retriesAllowed) {
        externalRetryCount += 1
        const backoffMs =
          (Number.isFinite(RUNNER_RETRY_BACKOFF_MS) ? Math.max(0, RUNNER_RETRY_BACKOFF_MS) : 0) *
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
          provider_id: PROVIDER_ID,
          model_id: MODEL_ID,
          mode: OPEN_CODE_MODE,
        },
        git: {
          repo: GIT_REPO,
          commit: GIT_COMMIT,
        },
        error: {
          type: failure.type,
          message: failure.message,
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
  } = options
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
          ? `No scenarios matched filter: ${scenarioFilter}`
          : "No benchmark scenarios found",
      )
    }

    let selectedScenarios: Scenario[]
    let resolvedScenarioSet: string | null

    if (scenarioFilter) {
      selectedScenarios = scenarios.filter((scenario) => scenario.id === scenarioFilter)
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

      selectedScenarios = selectedScenarioIds.map((scenarioId) => {
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

    if (selectedScenarios.length === 0) {
      throw new Error(`No scenarios matched filter: ${scenarioFilter ?? scenarioSet ?? "default"}`)
    }
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

        await seedFixtureManifest({
          repo: seedSourceRepo,
          outFile: fixtureManifestPath,
          seedId: process.env.BENCH_FIXTURE_SEED_ID ?? "default",
        })
      }

      fixtureManifest = await loadFixtureManifest(fixtureManifestPath)
    }

    if (fixtureManifest) {
      selectedScenarios = selectedScenarios.map((scenario) =>
        resolveScenarioFixtureBindings(scenario, fixtureManifest as FixtureManifest),
      )
    }

    if (mode === "ghx") {
      assertGhxRouterPreflight(selectedScenarios)
    }

    const outFile = join(
      RESULTS_DIR,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode}-suite.jsonl`,
    )

    const selectedScenarioIds = selectedScenarios.map((scenario) => scenario.id)
    console.log(
      `[benchmark] start: mode=${mode} provider=${PROVIDER_ID} model=${MODEL_ID} opencode_mode=${OPEN_CODE_MODE ?? "<null>"}`,
    )
    console.log(
      `[benchmark] config: repetitions=${repetitions} scenario_set=${resolvedScenarioSet ?? "<null>"} scenario_filter=${scenarioFilter ?? "<null>"} scenarios=${selectedScenarios.length}`,
    )
    console.log(`[benchmark] scenarios: ${selectedScenarioIds.join(",")}`)
    console.log(
      `[benchmark] context: opencode_port=${OPENCODE_PORT} git_repo=${GIT_REPO ?? "<null>"} git_commit=${GIT_COMMIT ?? "<null>"} out_file=${outFile}`,
    )

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
      validateFixture(scenario)

      for (let iteration = 1; iteration <= repetitions; iteration += 1) {
        emitProgressEvent("scenario_started", {
          scenario_id: scenario.id,
          iteration,
          total: totalScenarioExecutions,
          completed: completedExecutions,
        })

        let latestResult: BenchmarkRow | null = null

        for (let attempt = 0; attempt <= scenario.allowed_retries; attempt += 1) {
          const result = await withIsolatedBenchmarkClient(mode, (client) =>
            runScenario(client, scenario, mode, iteration, resolvedScenarioSet),
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
