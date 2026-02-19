import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "../../../normalizer.js"
import type { CliHandler } from "../helpers.js"
import {
  commandTokens,
  DEFAULT_TIMEOUT_MS,
  isCheckFailureBucket,
  isCheckPassBucket,
  isCheckPendingBucket,
  jsonFieldsFromCard,
  normalizeCheckItem,
  normalizeListItem,
  parseCliData,
  parseListFirst,
  parseNonEmptyString,
  parseStrictPositiveInt,
  sanitizeCliErrorMessage,
  shouldFallbackRerunFailedToAll,
} from "../helpers.js"

const handlePrView: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.view")

    const args = [...commandTokens(card, "pr view"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push("--json", jsonFieldsFromCard(card, "id,number,title,state,url,body,labels"))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.view", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const item = normalizeListItem(data)
    const raw =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    return normalizeResult(
      {
        ...item,
        body: typeof raw.body === "string" ? raw.body : "",
        labels: Array.isArray(raw.labels)
          ? (raw.labels as unknown[])
              .map((l) =>
                typeof l === "object" && l !== null
                  ? (l as Record<string, unknown>).name
                  : undefined,
              )
              .filter((n): n is string => typeof n === "string")
          : [],
      },
      "cli",
      { capabilityId: "pr.view", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "pr.view", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.view", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const first = parseListFirst(params.first)
    if (first === null) throw new Error("Missing or invalid first for pr.list")

    const args = commandTokens(card, "pr list")
    if (repo) args.push("--repo", repo)
    args.push(
      "--limit",
      String(first),
      "--json",
      jsonFieldsFromCard(card, "id,number,title,state,url"),
    )

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const items = Array.isArray(data) ? data.map((entry) => normalizeListItem(entry)) : []
    return normalizeResult({ items, pageInfo: { hasNextPage: false, endCursor: null } }, "cli", {
      capabilityId: "pr.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "pr.list", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.list", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrCreate: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const title = parseNonEmptyString(params.title)
    if (title === null) throw new Error("Missing or invalid title for pr.create")
    const head = parseNonEmptyString(params.head)
    if (head === null) throw new Error("Missing or invalid head for pr.create")

    const args = [...commandTokens(card, "pr create"), "--title", title, "--head", head]
    if (repo) args.push("--repo", repo)
    const body = parseNonEmptyString(params.body)
    if (body) args.push("--body", body)
    const base = parseNonEmptyString(params.base)
    if (base) args.push("--base", base)
    if (params.draft === true) args.push("--draft")

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.create", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.create", reason: "CARD_FALLBACK" },
      )
    }

    const stdout = result.stdout
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/)
    return normalizeResult(
      {
        number: urlMatch ? Number(urlMatch[1]) : Number(params.prNumber) || 1,
        url: urlMatch
          ? urlMatch[0]
          : stdout.trim() || `https://github.com/${params.owner}/${params.name}/pull/0`,
        title: typeof params.title === "string" ? params.title : "",
        state: "OPEN",
        draft: params.draft === true,
      },
      "cli",
      { capabilityId: "pr.create", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.create", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrUpdate: CliHandler = async (runner, params, _card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.update")

    const title = parseNonEmptyString(params.title)
    const body = typeof params.body === "string" ? params.body : null
    const hasDraft = typeof params.draft === "boolean"
    const hasEditFields = title !== null || body !== null

    if (!hasEditFields && !hasDraft) throw new Error("Missing title, body, or draft for pr.update")

    if (hasEditFields) {
      const editArgs = ["pr", "edit", String(prNumber)]
      if (repo) editArgs.push("--repo", repo)
      if (title !== null) editArgs.push("--title", title)
      if (body !== null) editArgs.push("--body", body)
      const editResult = await runner.run("gh", editArgs, DEFAULT_TIMEOUT_MS)
      if (editResult.exitCode !== 0) {
        const code = mapErrorToCode(editResult.stderr)
        return normalizeError(
          {
            code,
            message: sanitizeCliErrorMessage(editResult.stderr, editResult.exitCode),
            retryable: isRetryableErrorCode(code),
            details: { capabilityId: "pr.update", exitCode: editResult.exitCode },
          },
          "cli",
          { capabilityId: "pr.update", reason: "CARD_FALLBACK" },
        )
      }
    }

    if (hasDraft) {
      const readyArgs = ["pr", "ready", String(prNumber)]
      if (repo) readyArgs.push("--repo", repo)
      if (params.draft === true) readyArgs.push("--undo")
      const readyResult = await runner.run("gh", readyArgs, DEFAULT_TIMEOUT_MS)
      if (readyResult.exitCode !== 0) {
        const code = mapErrorToCode(readyResult.stderr)
        return normalizeError(
          {
            code,
            message: sanitizeCliErrorMessage(readyResult.stderr, readyResult.exitCode),
            retryable: isRetryableErrorCode(code),
            details: { capabilityId: "pr.update", exitCode: readyResult.exitCode },
          },
          "cli",
          { capabilityId: "pr.update", reason: "CARD_FALLBACK" },
        )
      }
    }

    const fallbackUrl = `https://github.com/${params.owner}/${params.name}/pull/${prNumber}`
    return normalizeResult(
      {
        number: prNumber,
        url: fallbackUrl,
        title: "",
        state: "OPEN",
        draft: typeof params.draft === "boolean" ? params.draft : false,
      },
      "cli",
      { capabilityId: "pr.update", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.update", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrChecksList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.checks.list")

    const args = [...commandTokens(card, "pr checks"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push("--json", jsonFieldsFromCard(card, "name,state,bucket,workflow,link"))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.checks.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.checks.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const checks = Array.isArray(data) ? data.map((entry) => normalizeCheckItem(entry)) : []
    const failed = checks.filter((entry) => isCheckFailureBucket(entry.bucket))
    const pending = checks.filter((entry) => isCheckPendingBucket(entry.bucket))
    const passed = checks.filter((entry) => isCheckPassBucket(entry.bucket))
    return normalizeResult(
      {
        items: checks,
        summary: {
          total: checks.length,
          failed: failed.length,
          pending: pending.length,
          passed: passed.length,
        },
      },
      "cli",
      { capabilityId: "pr.checks.list", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "pr.checks.list", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.checks.list", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrChecksFailed: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.checks.failed")

    const args = [...commandTokens(card, "pr checks"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push("--json", jsonFieldsFromCard(card, "name,state,bucket,workflow,link"))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.checks.failed", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.checks.failed", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const checks = Array.isArray(data) ? data.map((entry) => normalizeCheckItem(entry)) : []
    const failed = checks.filter((entry) => isCheckFailureBucket(entry.bucket))
    const pending = checks.filter((entry) => isCheckPendingBucket(entry.bucket))
    const passed = checks.filter((entry) => isCheckPassBucket(entry.bucket))
    return normalizeResult(
      {
        items: failed,
        summary: {
          total: checks.length,
          failed: failed.length,
          pending: pending.length,
          passed: passed.length,
        },
      },
      "cli",
      { capabilityId: "pr.checks.failed", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "pr.checks.failed", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.checks.failed", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrMergeStatus: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.merge.status")

    const args = [...commandTokens(card, "pr view"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push(
      "--json",
      jsonFieldsFromCard(card, "mergeable,mergeStateStatus,reviewDecision,isDraft,state"),
    )

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.merge.status", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.merge.status", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const input =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    return normalizeResult(
      {
        mergeable: typeof input.mergeable === "string" ? input.mergeable : null,
        mergeStateStatus:
          typeof input.mergeStateStatus === "string" ? input.mergeStateStatus : null,
        reviewDecision: typeof input.reviewDecision === "string" ? input.reviewDecision : null,
        isDraft: Boolean(input.isDraft),
        state: typeof input.state === "string" ? input.state : "UNKNOWN",
      },
      "cli",
      { capabilityId: "pr.merge.status", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "pr.merge.status", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.merge.status", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrReviewSubmit: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.review.submit")
    const event = params.event
    if (event !== "APPROVE" && event !== "COMMENT" && event !== "REQUEST_CHANGES")
      throw new Error("Missing or invalid event for pr.review.submit")

    const args = [...commandTokens(card, "pr review"), String(prNumber)]
    if (repo) args.push("--repo", repo)

    if (event === "APPROVE") {
      args.push("--approve")
      const body = parseNonEmptyString(params.body)
      if (body) args.push("--body", body)
    } else {
      const body = parseNonEmptyString(params.body)
      if (body === null) throw new Error("Missing or invalid body for pr.review.submit")
      if (event === "REQUEST_CHANGES") args.push("--request-changes", "--body", body)
      else args.push("--comment", "--body", body)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.review.submit", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.review.submit", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult(
      {
        prNumber: Number(params.prNumber),
        event: String(params.event),
        submitted: true,
        body: typeof params.body === "string" ? params.body : null,
      },
      "cli",
      { capabilityId: "pr.review.submit", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.review.submit", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrMerge: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.merge")
    const method = params.method === undefined ? "merge" : params.method
    if (method !== "merge" && method !== "squash" && method !== "rebase")
      throw new Error("Missing or invalid method for pr.merge")
    if (params.deleteBranch !== undefined && typeof params.deleteBranch !== "boolean")
      throw new Error("Missing or invalid deleteBranch for pr.merge")

    const args = [...commandTokens(card, "pr merge"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push(`--${method}`)
    if (params.deleteBranch === true) args.push("--delete-branch")

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.merge", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.merge", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult(
      {
        prNumber: Number(params.prNumber),
        method: method === "squash" || method === "rebase" ? method : "merge",
        queued: true,
        deleteBranch: params.deleteBranch === true,
      },
      "cli",
      { capabilityId: "pr.merge", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.merge", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrChecksRerunFailed: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.checks.rerun_failed")
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) throw new Error("Missing or invalid runId for pr.checks.rerun_failed")

    const args = [...commandTokens(card, "run rerun"), String(runId)]
    if (repo) args.push("--repo", repo)
    args.push("--failed")

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      if (shouldFallbackRerunFailedToAll(result.stderr)) {
        const rerunAllArgs = [...commandTokens(card, "run rerun"), String(runId)]
        if (repo) rerunAllArgs.push("--repo", repo)
        const rerunAllResult = await runner.run("gh", rerunAllArgs, DEFAULT_TIMEOUT_MS)
        if (rerunAllResult.exitCode === 0) {
          return normalizeResult(
            {
              prNumber: Number(params.prNumber),
              runId: Number(params.runId),
              mode: "all",
              queued: true,
            },
            "cli",
            { capabilityId: "pr.checks.rerun_failed", reason: "CARD_FALLBACK" },
          )
        }
        const failureStderr = rerunAllResult.stderr || rerunAllResult.stdout || result.stderr
        const code = mapErrorToCode(failureStderr)
        return normalizeError(
          {
            code,
            message: sanitizeCliErrorMessage(failureStderr, rerunAllResult.exitCode),
            retryable: isRetryableErrorCode(code),
            details: { capabilityId: "pr.checks.rerun_failed", exitCode: rerunAllResult.exitCode },
          },
          "cli",
          { capabilityId: "pr.checks.rerun_failed", reason: "CARD_FALLBACK" },
        )
      }
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.checks.rerun_failed", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.checks.rerun_failed", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult(
      {
        prNumber: Number(params.prNumber),
        runId: Number(params.runId),
        mode: "failed",
        queued: true,
      },
      "cli",
      { capabilityId: "pr.checks.rerun_failed", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.checks.rerun_failed", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrChecksRerunAll: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.checks.rerun_all")
    const runId = parseStrictPositiveInt(params.runId)
    if (runId === null) throw new Error("Missing or invalid runId for pr.checks.rerun_all")

    const args = [...commandTokens(card, "run rerun"), String(runId)]
    if (repo) args.push("--repo", repo)

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.checks.rerun_all", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.checks.rerun_all", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult(
      { prNumber: Number(params.prNumber), runId: Number(params.runId), mode: "all", queued: true },
      "cli",
      { capabilityId: "pr.checks.rerun_all", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.checks.rerun_all", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrReviewRequest: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.review.request")
    const reviewers = Array.isArray(params.reviewers)
      ? params.reviewers.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []
    if (reviewers.length === 0)
      throw new Error("Missing or invalid reviewers for pr.review.request")

    const args = [...commandTokens(card, "pr edit"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push("--add-reviewer", reviewers.join(","))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.review.request", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.review.request", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ prNumber: Number(params.prNumber), reviewers, updated: true }, "cli", {
      capabilityId: "pr.review.request",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.review.request", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrAssigneesUpdate: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.assignees.update")
    const addAssignees = Array.isArray(params.add)
      ? params.add.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []
    const removeAssignees = Array.isArray(params.remove)
      ? params.remove.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []
    if (addAssignees.length === 0 && removeAssignees.length === 0)
      throw new Error("Missing or invalid add/remove assignees for pr.assignees.update")

    const args = [...commandTokens(card, "pr edit"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    if (addAssignees.length > 0) args.push("--add-assignee", addAssignees.join(","))
    if (removeAssignees.length > 0) args.push("--remove-assignee", removeAssignees.join(","))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.assignees.update", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.assignees.update", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult(
      {
        prNumber: Number(params.prNumber),
        add: addAssignees,
        remove: removeAssignees,
        updated: true,
      },
      "cli",
      { capabilityId: "pr.assignees.update", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.assignees.update", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrBranchUpdate: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.branch.update")

    const args = [...commandTokens(card, "pr update-branch"), String(prNumber)]
    if (repo) args.push("--repo", repo)

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.branch.update", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.branch.update", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ prNumber: Number(params.prNumber), updated: true }, "cli", {
      capabilityId: "pr.branch.update",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.branch.update", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrDiffView: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.diff.view")

    const args = [...commandTokens(card, "pr diff"), String(prNumber)]
    if (repo) args.push("--repo", repo)

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.diff.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.diff.view", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ diff: result.stdout }, "cli", {
      capabilityId: "pr.diff.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.diff.view", reason: "CARD_FALLBACK" },
    )
  }
}

const handlePrDiffFiles: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""
    const prNumber = parseStrictPositiveInt(params.prNumber)
    if (prNumber === null) throw new Error("Missing or invalid prNumber for pr.diff.files")
    const first = parseListFirst(params.first)
    if (first === null) throw new Error("Missing or invalid first for pr.diff.files")

    const args = [...commandTokens(card, "pr view"), String(prNumber)]
    if (repo) args.push("--repo", repo)
    args.push("--json", jsonFieldsFromCard(card, "files"))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "pr.diff.files", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "pr.diff.files", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    return normalizeResult(data, "cli", {
      capabilityId: "pr.diff.files",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "pr.diff.files", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "pr.diff.files", reason: "CARD_FALLBACK" },
    )
  }
}

const handleCheckRunAnnotationsList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    if (!owner || !name) throw new Error("Missing owner/name for check_run.annotations.list")
    const checkRunId = parseStrictPositiveInt(params.checkRunId)
    if (checkRunId === null)
      throw new Error("Missing or invalid checkRunId for check_run.annotations.list")

    const args = [
      ...commandTokens(card, "api"),
      `repos/${owner}/${name}/check-runs/${checkRunId}/annotations`,
    ]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "check_run.annotations.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "check_run.annotations.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const annotations = Array.isArray(data) ? data : []
    return normalizeResult(
      {
        items: annotations.map((annotation) => {
          if (typeof annotation !== "object" || annotation === null || Array.isArray(annotation)) {
            return {
              path: null,
              startLine: null,
              endLine: null,
              level: null,
              message: null,
              title: null,
              details: null,
            }
          }
          const record = annotation as Record<string, unknown>
          return {
            path: typeof record.path === "string" ? record.path : null,
            startLine: typeof record.start_line === "number" ? record.start_line : null,
            endLine: typeof record.end_line === "number" ? record.end_line : null,
            level: typeof record.annotation_level === "string" ? record.annotation_level : null,
            message: typeof record.message === "string" ? record.message : null,
            title: typeof record.title === "string" ? record.title : null,
            details: typeof record.raw_details === "string" ? record.raw_details : null,
          }
        }),
      },
      "cli",
      { capabilityId: "check_run.annotations.list", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "check_run.annotations.list", reason: "CARD_FALLBACK" },
      )
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "check_run.annotations.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handlers: Record<string, CliHandler> = {
  "pr.view": handlePrView,
  "pr.list": handlePrList,
  "pr.create": handlePrCreate,
  "pr.update": handlePrUpdate,
  "pr.checks.list": handlePrChecksList,
  "pr.checks.failed": handlePrChecksFailed,
  "pr.merge.status": handlePrMergeStatus,
  "pr.review.submit": handlePrReviewSubmit,
  "pr.merge": handlePrMerge,
  "pr.checks.rerun_failed": handlePrChecksRerunFailed,
  "pr.checks.rerun_all": handlePrChecksRerunAll,
  "pr.review.request": handlePrReviewRequest,
  "pr.assignees.update": handlePrAssigneesUpdate,
  "pr.branch.update": handlePrBranchUpdate,
  "pr.diff.view": handlePrDiffView,
  "pr.diff.files": handlePrDiffFiles,
  "check_run.annotations.list": handleCheckRunAnnotationsList,
}
