import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "../../../normalizer.js"
import type { CliHandler } from "../helpers.js"
import {
  commandTokens,
  DEFAULT_TIMEOUT_MS,
  ISSUE_COMMENTS_GRAPHQL_QUERY,
  jsonFieldsFromCard,
  normalizeListItem,
  parseCliData,
  parseListFirst,
  parseStrictPositiveInt,
  sanitizeCliErrorMessage,
} from "../helpers.js"

export const handleIssueView: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.view")
    }

    const args = [...commandTokens(card, "issue view"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }
    args.push("--json", jsonFieldsFromCard(card, "id,number,title,state,url,body,labels"))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "issue.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.view", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const item = normalizeListItem(data)
    const raw =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}

    const normalized = {
      ...item,
      body: typeof raw.body === "string" ? raw.body : "",
      labels: Array.isArray(raw.labels)
        ? (raw.labels as unknown[])
            .map((l) =>
              typeof l === "object" && l !== null ? (l as Record<string, unknown>).name : undefined,
            )
            .filter((n): n is string => typeof n === "string")
        : [],
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "issue.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "issue.view", reason: "CARD_FALLBACK" },
      )
    }
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "issue.view", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleIssueList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for issue.list")
    }

    const args = commandTokens(card, "issue list")
    if (repo) {
      args.push("--repo", repo)
    }
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
          details: { capabilityId: "issue.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const items = Array.isArray(data) ? data.map((entry) => normalizeListItem(entry)) : []

    return normalizeResult({ items, pageInfo: { hasNextPage: false, endCursor: null } }, "cli", {
      capabilityId: "issue.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "issue.list", reason: "CARD_FALLBACK" },
      )
    }
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "issue.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleIssueCommentsList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    if (!owner || !name) {
      throw new Error("Missing owner/name for issue.comments.list")
    }

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
      `first=${first}`,
    ]

    if (typeof after === "string" && after.length > 0) {
      args.push("-f", `after=${after}`)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "issue.comments.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.comments.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const input =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const commentsConnection =
      typeof input.data === "object" && input.data !== null && !Array.isArray(input.data)
        ? (input.data as Record<string, unknown>).repository
        : null
    const repository =
      typeof commentsConnection === "object" &&
      commentsConnection !== null &&
      !Array.isArray(commentsConnection)
        ? (commentsConnection as Record<string, unknown>)
        : null
    const issue =
      typeof repository?.issue === "object" &&
      repository.issue !== null &&
      !Array.isArray(repository.issue)
        ? (repository.issue as Record<string, unknown>)
        : null
    const comments =
      typeof issue?.comments === "object" &&
      issue.comments !== null &&
      !Array.isArray(issue.comments)
        ? (issue.comments as Record<string, unknown>)
        : null
    const nodes = Array.isArray(comments?.nodes) ? comments.nodes : null
    const pageInfo =
      typeof comments?.pageInfo === "object" &&
      comments.pageInfo !== null &&
      !Array.isArray(comments.pageInfo)
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

      return [
        {
          id: commentRecord.id,
          body: commentRecord.body,
          authorLogin: typeof author?.login === "string" ? author.login : null,
          url: commentRecord.url,
          createdAt: commentRecord.createdAt,
        },
      ]
    })

    return normalizeResult(
      {
        items: normalizedItems,
        pageInfo: {
          hasNextPage: pageInfo.hasNextPage,
          endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null,
        },
      },
      "cli",
      { capabilityId: "issue.comments.list", reason: "CARD_FALLBACK" },
    )
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "issue.comments.list", reason: "CARD_FALLBACK" },
      )
    }

    if (error instanceof Error && error.message.toLowerCase().includes("invalid cli payload")) {
      return normalizeError(
        { code: errorCodes.Server, message: error.message, retryable: false },
        "cli",
        { capabilityId: "issue.comments.list", reason: "CARD_FALLBACK" },
      )
    }

    if (error instanceof Error && error.message.toLowerCase().includes("invalid after cursor")) {
      return normalizeError(
        { code: errorCodes.Validation, message: error.message, retryable: false },
        "cli",
        { capabilityId: "issue.comments.list", reason: "CARD_FALLBACK" },
      )
    }

    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "cli",
      { capabilityId: "issue.comments.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleIssueLabelsRemove: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.labels.remove")
    }

    const labels = Array.isArray(params.labels)
      ? params.labels.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []
    if (labels.length === 0) {
      throw new Error("Missing or invalid labels for issue.labels.remove")
    }

    const args = [...commandTokens(card, "issue edit"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }
    args.push("--remove-label", labels.join(","))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "issue.labels.remove", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.labels.remove", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ issueNumber, removed: labels }, "cli", {
      capabilityId: "issue.labels.remove",
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
      { capabilityId: "issue.labels.remove", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleIssueAssigneesAdd: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.assignees.add")
    }

    const assignees = Array.isArray(params.assignees)
      ? params.assignees.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []
    if (assignees.length === 0) {
      throw new Error("Missing or invalid assignees for issue.assignees.add")
    }

    const args = [...commandTokens(card, "issue edit"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }
    args.push("--add-assignee", assignees.join(","))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "issue.assignees.add", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.assignees.add", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ issueNumber, added: assignees }, "cli", {
      capabilityId: "issue.assignees.add",
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
      { capabilityId: "issue.assignees.add", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleIssueAssigneesRemove: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.assignees.remove")
    }

    const assignees = Array.isArray(params.assignees)
      ? params.assignees.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []
    if (assignees.length === 0) {
      throw new Error("Missing or invalid assignees for issue.assignees.remove")
    }

    const args = [...commandTokens(card, "issue edit"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }
    args.push("--remove-assignee", assignees.join(","))

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "issue.assignees.remove", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.assignees.remove", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ issueNumber, removed: assignees }, "cli", {
      capabilityId: "issue.assignees.remove",
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
      { capabilityId: "issue.assignees.remove", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleIssueMilestoneClear: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")
    const repo = owner && name ? `${owner}/${name}` : ""

    const issueNumber = parseStrictPositiveInt(params.issueNumber)
    if (issueNumber === null) {
      throw new Error("Missing or invalid issueNumber for issue.milestone.clear")
    }

    const args = [...commandTokens(card, "issue edit"), String(issueNumber)]
    if (repo) {
      args.push("--repo", repo)
    }
    args.push("--milestone", "")

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "issue.milestone.clear", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "issue.milestone.clear", reason: "CARD_FALLBACK" },
      )
    }

    return normalizeResult({ issueNumber, cleared: true }, "cli", {
      capabilityId: "issue.milestone.clear",
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
      { capabilityId: "issue.milestone.clear", reason: "CARD_FALLBACK" },
    )
  }
}

export const handlers: Record<string, CliHandler> = {
  "issue.view": handleIssueView,
  "issue.list": handleIssueList,
  "issue.comments.list": handleIssueCommentsList,
  "issue.labels.remove": handleIssueLabelsRemove,
  "issue.assignees.add": handleIssueAssigneesAdd,
  "issue.assignees.remove": handleIssueAssigneesRemove,
  "issue.milestone.clear": handleIssueMilestoneClear,
}
