import type { SessionMessageEntry, SessionMessagePart } from "@bench/domain/types.js"
import { isObject } from "@bench/util/guards.js"

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

export function hasStructuredOutput(info: unknown): boolean {
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

export function hasAssistantSignal(entry: SessionMessageEntry): boolean {
  if (!entry.info) {
    return false
  }

  return (
    hasAssistantMetadata(entry.info) ||
    hasStructuredOutput(entry.info) ||
    (entry.info as { role?: unknown }).role === "assistant"
  )
}

export function messageProgressSignature(messages: SessionMessageEntry[]): string {
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

  const data = unwrapData<SessionMessageEntry[]>(messagesResult, "session.messages")
  return data
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

export async function waitForAssistantFromMessages(
  sessionApi: ReturnType<typeof getSessionApi>,
  sessionId: string,
  timeoutMs: number,
  _scenarioId: string,
  previousAssistantId?: string,
): Promise<PromptResponse> {
  const started = Date.now()
  let lastWaitLogAt = started
  let lastProgressAt = started
  let lastSignature = ""
  const firstAssistantBudgetMs = timeoutMs
  const stallBudgetMs = timeoutMs

  const getCreatedAt = (entry: SessionMessageEntry): number => {
    if (!entry.info || !isObject(entry.info)) {
      return Number.NEGATIVE_INFINITY
    }

    const info = entry.info as { time?: unknown }
    return (
      asNumber(
        (isObject(info.time)
          ? (info.time as Record<string, number>).created
          : undefined) as unknown,
      ) ?? Number.NEGATIVE_INFINITY
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
      console.log(`[benchmark] waiting: session=${sessionId} elapsed_ms=${now - started}`)
      lastWaitLogAt = now
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error("Timed out waiting for assistant message in session.messages")
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null
}
