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

function buildArgs(capabilityId: CliCapabilityId, params: Record<string, unknown>): string[] {
  const owner = String(params.owner ?? "")
  const name = String(params.name ?? "")
  const repo = owner && name ? `${owner}/${name}` : ""

  if (capabilityId === "repo.view") {
    return ["repo", "view", repo, "--json", "id,name,nameWithOwner,isPrivate,stargazerCount,forkCount,url,defaultBranchRef"]
  }

  if (capabilityId === "issue.view") {
    return ["issue", "view", String(params.issueNumber), "--repo", repo, "--json", "id,number,title,state,url"]
  }

  if (capabilityId === "issue.list") {
    return ["issue", "list", "--repo", repo, "--limit", String(params.first ?? 30), "--json", "id,number,title,state,url"]
  }

  if (capabilityId === "pr.view") {
    return ["pr", "view", String(params.prNumber), "--repo", repo, "--json", "id,number,title,state,url"]
  }

  return ["pr", "list", "--repo", repo, "--limit", String(params.first ?? 30), "--json", "id,number,title,state,url"]
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
