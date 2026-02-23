import type { SessionMessageEntry, SessionMessagePart } from "@bench/domain/types.js"
import { isObject } from "@bench/util/guards.js"
import {
  fetchSessionMessages,
  getSessionApi,
  hasAssistantMetadata,
  hasAssistantSignal,
  hasStructuredOutput,
  hasTextPart,
  messageProgressSignature,
} from "./polling.js"
import type { AssistantMessage, PromptResponse } from "./types.js"

type SessionApi = ReturnType<typeof getSessionApi>

function getCreatedAt(entry: SessionMessageEntry): number {
  if (!entry.info || !isObject(entry.info)) {
    return Number.NEGATIVE_INFINITY
  }

  const info = entry.info as { time?: unknown }
  const time = isObject(info.time) ? (info.time as Record<string, number>) : null
  return time?.created ?? Number.NEGATIVE_INFINITY
}

function isCompletedAssistantEntry(
  info: object,
  parts: SessionMessagePart[],
  previousAssistantId: string | undefined,
): boolean {
  const role = (info as { role?: unknown }).role
  const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
  const assistantByRole = role === "assistant"
  const assistantByMetadata = hasAssistantMetadata(info)
  const assistantWithStructuredOutput = hasStructuredOutput(info)
  const assistantByTextSignal =
    previousAssistantId !== undefined && hasTextPart(parts) && stepFinish?.reason !== "tool-calls"
  const hasCompletedStep =
    stepFinish !== undefined && stepFinish.reason !== "tool-calls" && stepFinish.reason !== "error"
  const isCompleted =
    (assistantByMetadata &&
      (hasCompletedStep ||
        (hasTextPart(parts) && stepFinish?.reason !== "tool-calls") ||
        assistantWithStructuredOutput)) ||
    hasCompletedStep ||
    assistantWithStructuredOutput

  if (!assistantByRole && !assistantByMetadata && !assistantByTextSignal) {
    return false
  }

  return isCompleted || assistantByTextSignal
}

function findLatestCompletedAssistant(
  candidates: SessionMessageEntry[],
  previousAssistantId: string | undefined,
): PromptResponse | null {
  const match = [...candidates].reverse().find((entry) => {
    if (!entry.info) {
      return false
    }
    return isCompletedAssistantEntry(entry.info as object, entry.parts ?? [], previousAssistantId)
  })

  if (!match?.info) {
    return null
  }

  return {
    info: match.info as AssistantMessage,
    parts: match.parts ?? [],
  }
}

function findContinuedMessage(
  messages: SessionMessageEntry[],
  previousAssistantId: string,
): PromptResponse | null {
  const continuedCandidates = messages.filter((entry) => {
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

  const latest = continuedCandidates.reduce<SessionMessageEntry | null>((acc, entry) => {
    if (!acc) {
      return entry
    }
    return getCreatedAt(entry) >= getCreatedAt(acc) ? entry : acc
  }, null)

  if (!latest?.info) {
    return null
  }

  return {
    info: latest.info as AssistantMessage,
    parts: latest.parts ?? [],
  }
}

export async function waitForAssistantFromMessages(
  sessionApi: SessionApi,
  sessionId: string,
  timeoutMs: number,
  _scenarioId: string,
  previousAssistantId?: string,
): Promise<PromptResponse> {
  const started = Date.now()
  let lastWaitLogAt = started
  let lastProgressAt = started
  let lastSignature = ""
  const firstAssistantBudgetMs = Math.min(30_000, timeoutMs)
  const stallBudgetMs = Math.min(60_000, timeoutMs)

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

    const latestAssistant = findLatestCompletedAssistant(candidates, previousAssistantId)
    if (latestAssistant) {
      return latestAssistant
    }

    if (previousAssistantId) {
      const continued = findContinuedMessage(messages, previousAssistantId)
      if (continued) {
        return continued
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
