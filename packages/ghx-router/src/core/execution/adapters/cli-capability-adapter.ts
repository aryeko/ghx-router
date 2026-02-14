import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import type { OperationCard } from "../../registry/types.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export type CliCapabilityId = "repo.view" | "issue.view" | "issue.list" | "issue.comments.list" | "pr.view" | "pr.list"

export type CliCommandRunner = {
  run(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_LIST_FIRST = 30
const ISSUE_COMMENTS_GRAPHQL_QUERY =
  "query($owner:String!,$name:String!,$issueNumber:Int!,$first:Int!,$after:String){repository(owner:$owner,name:$name){issue(number:$issueNumber){comments(first:$first,after:$after){nodes{id body createdAt url author{login}} pageInfo{hasNextPage endCursor}}}}}"

function parseStrictPositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

function parseListFirst(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_LIST_FIRST
  }

  return parseStrictPositiveInt(value)
}

function commandTokens(card: OperationCard | undefined, fallbackCommand: string): string[] {
  const fromCard = card?.cli?.command
  const command = typeof fromCard === "string" && fromCard.trim().length > 0 ? fromCard : fallbackCommand
  return command.trim().split(/\s+/)
}

function jsonFieldsFromCard(card: OperationCard | undefined, fallbackFields: string): string {
  const fields = card?.cli?.jsonFields
  if (Array.isArray(fields) && fields.length > 0) {
    return fields.join(",")
  }

  return fallbackFields
}

function buildArgs(capabilityId: CliCapabilityId, params: Record<string, unknown>, card?: OperationCard): string[] {
  const owner = String(params.owner ?? "")
  const name = String(params.name ?? "")
  const repo = owner && name ? `${owner}/${name}` : ""

  if (capabilityId === "repo.view") {
    const args = commandTokens(card, "repo view")
    if (repo) {
      args.push(repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,name,nameWithOwner,isPrivate,stargazerCount,forkCount,url,defaultBranchRef"))
    return args
  }

  if (capabilityId === "issue.view") {
    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.view")
    }

    const args = [...commandTokens(card, "issue view"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "issue.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for issue.list")
    }

    const args = commandTokens(card, "issue list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "issue.comments.list") {
    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.comments.list")
    }

    const first = parseStrictPositiveInt(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for issue.comments.list")
    }

    const after = params.after
    if (!(after === undefined || after === null || typeof after === "string")) {
      throw new Error("Invalid after cursor for issue.comments.list")
    }

    const args = [
      ...commandTokens(card, "api graphql"),
      "-f",
      `query=${ISSUE_COMMENTS_GRAPHQL_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `issueNumber=${issueNumber}`,
      "-F",
      `first=${first}`
    ]

    if (typeof after === "string" && after.length > 0) {
      args.push("-f", `after=${after}`)
    }

    return args
  }

  if (capabilityId === "pr.view") {
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) {
      throw new Error("Missing or invalid prNumber for pr.view")
    }

    const args = [...commandTokens(card, "pr view"), String(prNumber)]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
    return args
  }

  if (capabilityId === "pr.list") {
    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for pr.list")
    }

    const args = commandTokens(card, "pr list")
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(first), "--json", jsonFieldsFromCard(card, "id,number,title,state,url"))
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
    if (parseStrictPositiveInt(params.first) === null) {
      throw new Error("Missing or invalid first for issue.comments.list")
    }

    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const commentsConnection =
      typeof input.data === "object" && input.data !== null && !Array.isArray(input.data)
        ? (input.data as Record<string, unknown>).repository
        : null
    const repository =
      typeof commentsConnection === "object" && commentsConnection !== null && !Array.isArray(commentsConnection)
        ? (commentsConnection as Record<string, unknown>)
        : null
    const issue =
      typeof repository?.issue === "object" && repository.issue !== null && !Array.isArray(repository.issue)
        ? (repository.issue as Record<string, unknown>)
        : null
    const comments =
      typeof issue?.comments === "object" && issue.comments !== null && !Array.isArray(issue.comments)
        ? (issue.comments as Record<string, unknown>)
        : null
    const nodes = Array.isArray(comments?.nodes) ? comments.nodes : null
    const pageInfo =
      typeof comments?.pageInfo === "object" && comments.pageInfo !== null && !Array.isArray(comments.pageInfo)
        ? (comments.pageInfo as Record<string, unknown>)
        : null

    if (nodes === null || pageInfo === null || typeof pageInfo.hasNextPage !== "boolean") {
      throw new Error("Invalid CLI payload: comments connection is malformed")
    }

    const normalizedItems = nodes.flatMap((comment) => {
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

    return {
      items: normalizedItems,
      pageInfo: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null
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
  params: Record<string, unknown>,
  card?: OperationCard
): Promise<ResultEnvelope> {
  try {
    const args = buildArgs(capabilityId, params, card)
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
    const normalized = normalizeCliData(capabilityId, data, params)
    return normalizeResult(normalized, "cli", { capabilityId, reason: "CARD_FALLBACK" })
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

    if (error instanceof Error && error.message.toLowerCase().includes("invalid after cursor")) {
      return normalizeError(
        {
          code: errorCodes.Validation,
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
