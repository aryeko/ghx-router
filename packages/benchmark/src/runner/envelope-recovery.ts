import type {
  BenchmarkMode,
  ScenarioAssertions,
  SessionMessageEntry,
  SessionMessagePart,
} from "../domain/types.js"
import { extractFirstJsonValue, validateEnvelope } from "../extract/envelope.js"
import { isObject } from "../utils/guards.js"

export function extractEnvelopeFromParts(parts: SessionMessagePart[]): {
  text: string
  envelope: unknown
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

export function extractEnvelopeFromMessages(messages: SessionMessageEntry[]): unknown | null {
  for (const message of [...messages].reverse()) {
    const fromParts = extractEnvelopeFromParts(message.parts ?? []).envelope
    if (fromParts !== null) {
      return fromParts
    }
  }

  return null
}

export function findBestEnvelopeFromMessages(
  messages: SessionMessageEntry[],
  assertions: ScenarioAssertions,
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

export function tryWrapRawDataAsEnvelope(
  envelope: unknown,
  assertions: ScenarioAssertions,
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
