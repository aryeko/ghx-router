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

function normalizeListLimit(value: unknown): number {
  const candidate = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(candidate) || candidate < 1) {
    return 30
  }

  return Math.floor(candidate)
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
    const issueNumber = params.issueNumber
    if (typeof issueNumber !== "number" || Number.isNaN(issueNumber) || issueNumber < 1) {
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
    const args = ["issue", "list"]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(normalizeListLimit(params.first)), "--json", "id,number,title,state,url")
    return args
  }

  if (capabilityId === "issue.comments.list") {
    const issueNumber = params.issueNumber
    if (typeof issueNumber !== "number" || Number.isNaN(issueNumber) || issueNumber < 1) {
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
    const prNumber = params.prNumber
    if (typeof prNumber !== "number" || Number.isNaN(prNumber) || prNumber < 1) {
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
    const args = ["pr", "list"]
    if (repo) {
      args.push("--repo", repo)
    }

    args.push("--limit", String(normalizeListLimit(params.first)), "--json", "id,number,title,state,url")
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

function normalizeCliData(capabilityId: CliCapabilityId, data: unknown): unknown {
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
    const input = typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
    const comments = Array.isArray(input.comments) ? input.comments : []
    return {
      items: comments.flatMap((comment) => {
        if (typeof comment !== "object" || comment === null || Array.isArray(comment)) {
          return []
        }

        const commentRecord = comment as Record<string, unknown>
        const author =
          typeof commentRecord.author === "object" && commentRecord.author !== null
            ? (commentRecord.author as Record<string, unknown>)
            : null

        return [
          {
            id: commentRecord.id,
            body: commentRecord.body,
            authorLogin: typeof author?.login === "string" ? author.login : null,
            url: commentRecord.url,
            createdAt: commentRecord.createdAt
          }
        ]
      }),
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
    const args = buildArgs(capabilityId, params)
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
    const normalized = normalizeCliData(capabilityId, data)
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
