import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export type CliCapabilityId = "repo.view" | "issue.view" | "issue.list" | "issue.comments.list" | "pr.view" | "pr.list"

export type CliCommandRunner = {
  run(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_COMMENTS_PER_CLI_CALL = 100
const DEFAULT_LIST_FIRST = 30

function parseStrictPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

function parseListFirst(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_LIST_FIRST
  }

  return parseStrictPositiveInt(value)
}

function buildArgs(capabilityId: CliCapabilityId, params: Record<string, unknown>): string[] {
  const owner = String(params.owner ?? "")
  const name = String(params.name ?? "")
  const repo = owner && name ? `${owner}/${name}` : ""

  if (capabilityId === "repo.view") {
    const args = ["repo", "view"]
    if (repo) {
      args.push(repo)
    }

    args.push("--json", "id,name,nameWithOwner,isPrivate,stargazerCount,forkCount,url,defaultBranchRef")
    return args
  }

  if (capabilityId === "issue.view") {
    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.view")
    }

    const args = ["issue", "view", String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", "id,number,title,state,url")
    return args
  }

  if (capabilityId === "issue.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for issue.list")
    }

    const args = ["issue", "list"]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", "id,number,title,state,url")
    return args
  }

  if (capabilityId === "issue.comments.list") {
    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.comments.list")
    }

    const args = ["issue", "view", String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", "comments")
    return args
  }

  if (capabilityId === "pr.view") {
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) {
      throw new Error("Missing or invalid prNumber for pr.view")
    }

    const args = ["pr", "view", String(prNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", "id,number,title,state,url")
    return args
  }

  if (capabilityId === "pr.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for pr.list")
    }

    const args = ["pr", "list"]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", "id,number,title,state,url")
    return args
  }

  throw new Error(`Unsupported CLI capability: ${capabilityId}`)
}

function parseCliData(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return {}
  }

  return JSON.parse(trimmed)
}

function normalizeListItem(item: unknown): Record<string, unknown> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return {}
  }

  const input = item as Record<string, unknown>
  return {
    id: input.id,
    number: input.number,
    title: input.title,
    state: input.state,
    url: input.url
  }
}

function normalizeCliData(capabilityId: CliCapabilityId, data: unknown, params: Record<string, unknown>): unknown {
  if (capabilityId === "repo.view") {
    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const defaultBranchRef =
      typeof input.defaultBranchRef === "object" && input.defaultBranchRef !== null
        ? (input.defaultBranchRef as Record<string, unknown>)
        : null

    return {
      id: input.id,
      name: input.name,
      nameWithOwner: input.nameWithOwner,
      isPrivate: input.isPrivate,
      stargazerCount: input.stargazerCount,
      forkCount: input.forkCount,
      url: input.url,
      defaultBranch:
        typeof defaultBranchRef?.name === "string"
          ? defaultBranchRef.name
          : null
    }
  }

  if (capabilityId === "issue.list" || capabilityId === "pr.list") {
    const items = Array.isArray(data) ? data.map((entry) => normalizeListItem(entry)) : []
    return {
      items,
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "issue.comments.list") {
    const limit = parseStrictPositiveInt(params.first)
    if (limit === null) {
      throw new Error("Missing or invalid first for issue.comments.list")
    }

    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    if (!("comments" in input) || !Array.isArray(input.comments)) {
      throw new Error("Invalid CLI payload: comments field must be an array")
    }

    const comments = input.comments
    const normalizedItems = comments.flatMap((comment) => {
      if (typeof comment !== "object" || comment === null || Array.isArray(comment)) {
        throw new Error("Invalid CLI payload: comment item must be an object")
      }

      const commentRecord = comment as Record<string, unknown>
      const author =
        typeof commentRecord.author === "object" && commentRecord.author !== null
          ? (commentRecord.author as Record<string, unknown>)
          : null

      if (
        typeof commentRecord.id !== "string" ||
        typeof commentRecord.body !== "string" ||
        typeof commentRecord.url !== "string" ||
        typeof commentRecord.createdAt !== "string"
      ) {
        throw new Error("Invalid CLI payload: comment item has invalid field types")
      }

      return [{
        id: commentRecord.id,
        body: commentRecord.body,
        authorLogin: typeof author?.login === "string" ? author.login : null,
        url: commentRecord.url,
        createdAt: commentRecord.createdAt
      }]
    })

    const items = normalizedItems.slice(0, limit)

    return {
      items,
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  }

  if (capabilityId === "issue.view" || capabilityId === "pr.view") {
    return normalizeListItem(data)
  }

  return data
}

export async function runCliCapability(
  runner: CliCommandRunner,
  capabilityId: CliCapabilityId,
  params: Record<string, unknown>
): Promise<ResultEnvelope> {
  try {
    let normalizedParams = params
    let paginationMeta: ResultEnvelope["meta"]["pagination"] | undefined

    if (capabilityId === "issue.comments.list") {
      const after = params.after
      if (typeof after === "string" && after.trim().length > 0) {
        return normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: "CLI fallback does not support cursor pagination for issue.comments.list",
            retryable: false,
            details: { capabilityId }
          },
          "cli",
          { capabilityId, reason: "CARD_FALLBACK" }
        )
      }

      const requestedLimit = parseStrictPositiveInt(params.first)
      if (requestedLimit === null) {
        return normalizeError(
          {
            code: errorCodes.Validation,
            message: "Missing or invalid first for issue.comments.list",
            retryable: false,
            details: { capabilityId }
          },
          "cli",
          { capabilityId, reason: "CARD_FALLBACK" }
        )
      }

      if (requestedLimit > MAX_COMMENTS_PER_CLI_CALL) {
        return normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `CLI fallback supports at most ${MAX_COMMENTS_PER_CLI_CALL} comments per call for issue.comments.list`,
            retryable: false,
            details: { capabilityId, maxCommentsPerCall: MAX_COMMENTS_PER_CLI_CALL }
          },
          "cli",
          { capabilityId, reason: "CARD_FALLBACK" }
        )
      }

      normalizedParams = {
        ...params,
        first: requestedLimit
      }
    }

    const args = buildArgs(capabilityId, normalizedParams)
    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: result.stderr || `gh exited with code ${result.exitCode}`,
          retryable: isRetryableErrorCode(code),
          details: { capabilityId, args, exitCode: result.exitCode }
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    const data = parseCliData(result.stdout)
    if (capabilityId === "issue.comments.list") {
      const limit = parseStrictPositiveInt(normalizedParams.first)
      const rawComments =
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        Array.isArray((data as Record<string, unknown>).comments)
          ? ((data as Record<string, unknown>).comments as unknown[])
          : []

      paginationMeta = {
        next: {
          cursor_supported: false,
          more_items_observed: limit !== null ? rawComments.length > limit : false
        }
      }
    }

    const normalized = normalizeCliData(capabilityId, data, normalizedParams)
    return normalizeResult(normalized, "cli", {
      capabilityId,
      reason: "CARD_FALLBACK",
      pagination: paginationMeta
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: "Failed to parse CLI JSON output",
          retryable: false
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    if (error instanceof Error && error.message.toLowerCase().includes("invalid cli payload")) {
      return normalizeError(
        {
          code: errorCodes.Server,
          message: error.message,
          retryable: false
        },
        "cli",
        { capabilityId, reason: "CARD_FALLBACK" }
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code)
      },
      "cli",
      { capabilityId, reason: "CARD_FALLBACK" }
    )
  }
}
