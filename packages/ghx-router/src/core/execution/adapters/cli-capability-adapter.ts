import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export type CliCapabilityId = "repo.view" | "issue.view" | "issue.list" | "pr.view" | "pr.list"

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
    return normalizeResult(data, "cli", { capabilityId, reason: "CARD_FALLBACK" })
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
