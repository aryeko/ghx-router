import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import type { OperationCard } from "@core/core/registry/types.js"
import type { CliCommandRunner } from "../cli-adapter.js"

export type { CliCommandRunner }

export type CliHandler = (
  runner: CliCommandRunner,
  params: Record<string, unknown>,
  card: OperationCard | undefined,
) => Promise<ResultEnvelope>

export const DEFAULT_TIMEOUT_MS = 10_000
export const DEFAULT_LIST_FIRST = 30
export const MAX_WORKFLOW_JOB_LOG_CHARS = 50_000
export const REDACTED_CLI_ERROR_MESSAGE = "gh command failed; stderr redacted for safety"
export const REPO_ISSUE_TYPES_GRAPHQL_QUERY =
  "query($owner:String!,$name:String!,$first:Int!,$after:String){repository(owner:$owner,name:$name){issueTypes(first:$first,after:$after){nodes{id name color isEnabled} pageInfo{hasNextPage endCursor}}}}"
export const ISSUE_COMMENTS_GRAPHQL_QUERY =
  "query($owner:String!,$name:String!,$issueNumber:Int!,$first:Int!,$after:String){repository(owner:$owner,name:$name){issue(number:$issueNumber){comments(first:$first,after:$after){nodes{id body createdAt url author{login}} pageInfo{hasNextPage endCursor}}}}}"

export function containsSensitiveText(value: string): boolean {
  return /(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|authorization:\s*bearer\s+\S+|bearer\s+[A-Za-z0-9._-]{20,}|(?:api[_-]?key|token|secret|password)\s*[=:]\s*\S+)/i.test(
    value,
  )
}

export function sanitizeCliErrorMessage(stderr: string, exitCode: number): string {
  const trimmed = stderr.trim()
  if (!trimmed) {
    return `gh exited with code ${exitCode}`
  }

  if (containsSensitiveText(trimmed)) {
    return REDACTED_CLI_ERROR_MESSAGE
  }

  return trimmed
}

export function shouldFallbackRerunFailedToAll(stderr: string): boolean {
  const normalized = stderr.toLowerCase()
  return normalized.includes("cannot be rerun") && normalized.includes("cannot be retried")
}

export function parseStrictPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

export function parseListFirst(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_LIST_FIRST
  }

  return parseStrictPositiveInt(value)
}

export function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function requireRepo(owner: string, name: string, capabilityId: string): void {
  if (!owner || !name) {
    throw new Error(`Missing owner/name for ${capabilityId}`)
  }
}

export function commandTokens(card: OperationCard | undefined, fallbackCommand: string): string[] {
  const fromCard = card?.cli?.command
  const command =
    typeof fromCard === "string" && fromCard.trim().length > 0 ? fromCard : fallbackCommand
  return command.trim().split(/\s+/)
}

export function jsonFieldsFromCard(
  card: OperationCard | undefined,
  fallbackFields: string,
): string {
  const fields = card?.cli?.jsonFields
  if (Array.isArray(fields) && fields.length > 0) {
    return fields.join(",")
  }

  return fallbackFields
}

export function parseCliData(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return {}
  }

  return JSON.parse(trimmed)
}

export function normalizeListItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {}
  }

  const input = item as Record<string, unknown>
  return {
    id: input.id,
    number: input.number,
    title: input.title,
    state: input.state,
    url: input.url,
  }
}

export function normalizeWorkflowItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {
      id: 0,
      name: null,
      path: null,
      state: null,
    }
  }

  const input = item as Record<string, unknown>
  return {
    id: typeof input.id === "number" ? input.id : 0,
    name: typeof input.name === "string" ? input.name : null,
    path: typeof input.path === "string" ? input.path : null,
    state: typeof input.state === "string" ? input.state : null,
  }
}

export function normalizeProjectV2Summary(data: unknown): Record<string, unknown> {
  const input =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}

  return {
    id: typeof input.id === "string" ? input.id : null,
    title: typeof input.title === "string" ? input.title : null,
    shortDescription: typeof input.shortDescription === "string" ? input.shortDescription : null,
    public: typeof input.public === "boolean" ? input.public : null,
    closed: typeof input.closed === "boolean" ? input.closed : null,
    url: typeof input.url === "string" ? input.url : null,
  }
}

export function normalizeCheckItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {
      name: null,
      state: null,
      bucket: null,
      workflow: null,
      link: null,
    }
  }

  const input = item as Record<string, unknown>
  return {
    name: typeof input.name === "string" ? input.name : null,
    state: typeof input.state === "string" ? input.state : null,
    bucket: typeof input.bucket === "string" ? input.bucket : null,
    workflow: typeof input.workflow === "string" ? input.workflow : null,
    link: typeof input.link === "string" ? input.link : null,
  }
}

export function normalizeCheckBucket(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  return value.trim().toLowerCase()
}

export function isCheckFailureBucket(bucket: unknown): boolean {
  const normalized = normalizeCheckBucket(bucket)
  if (!normalized) {
    return false
  }

  return normalized === "fail" || normalized === "cancel"
}

export function isCheckPendingBucket(bucket: unknown): boolean {
  const normalized = normalizeCheckBucket(bucket)
  if (!normalized) {
    return false
  }

  return normalized === "pending"
}

export function isCheckPassBucket(bucket: unknown): boolean {
  const normalized = normalizeCheckBucket(bucket)
  if (!normalized) {
    return false
  }

  return normalized === "pass"
}
