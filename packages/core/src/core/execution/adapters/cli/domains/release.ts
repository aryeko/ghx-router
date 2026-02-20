import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "../../../normalizer.js"
import type { CliHandler } from "../helpers.js"
import {
  commandTokens,
  DEFAULT_TIMEOUT_MS,
  parseCliData,
  parseListFirst,
  parseNonEmptyString,
  parseStrictPositiveInt,
  requireRepo,
  sanitizeCliErrorMessage,
} from "../helpers.js"

function normalizeRelease(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      id: 0,
      tagName: null,
      name: null,
      isDraft: false,
      isPrerelease: false,
      url: null,
      targetCommitish: null,
      createdAt: null,
      publishedAt: null,
    }
  }

  const record = input as Record<string, unknown>
  return {
    id: typeof record.id === "number" ? record.id : 0,
    tagName: typeof record.tag_name === "string" ? record.tag_name : null,
    name: typeof record.name === "string" ? record.name : null,
    isDraft: typeof record.draft === "boolean" ? record.draft : false,
    isPrerelease: typeof record.prerelease === "boolean" ? record.prerelease : false,
    url: typeof record.html_url === "string" ? record.html_url : null,
    targetCommitish: typeof record.target_commitish === "string" ? record.target_commitish : null,
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
    publishedAt: typeof record.published_at === "string" ? record.published_at : null,
  }
}

export const handleReleaseList: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "release.list")

    const first = parseListFirst(params.first)
    if (first === null) {
      throw new Error("Missing or invalid first for release.list")
    }

    const args = [
      ...commandTokens(card, "api"),
      `repos/${owner}/${name}/releases`,
      "-F",
      `per_page=${first}`,
    ]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "release.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "release.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const items = Array.isArray(data) ? data.map((entry) => normalizeRelease(entry)) : []

    return normalizeResult({ items, pageInfo: { hasNextPage: false, endCursor: null } }, "cli", {
      capabilityId: "release.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "release.list", reason: "CARD_FALLBACK" },
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
      { capabilityId: "release.list", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleReleaseGet: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "release.view")

    const tagName = parseNonEmptyString(params.tagName)
    if (tagName === null) {
      throw new Error("Missing or invalid tagName for release.view")
    }

    const args = [
      ...commandTokens(card, "api"),
      `repos/${owner}/${name}/releases/tags/${encodeURIComponent(tagName)}`,
    ]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "release.view", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "release.view", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const normalized = normalizeRelease(data)

    return normalizeResult(normalized, "cli", {
      capabilityId: "release.view",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "release.view", reason: "CARD_FALLBACK" },
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
      { capabilityId: "release.view", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleReleaseCreateDraft: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "release.create")

    const tagName = parseNonEmptyString(params.tagName)
    if (tagName === null) {
      throw new Error("Missing or invalid tagName for release.create")
    }

    const args = [
      ...commandTokens(card, "api"),
      `repos/${owner}/${name}/releases`,
      "--method",
      "POST",
      "-f",
      `tag_name=${tagName}`,
      "-F",
      "draft=true",
    ]

    const title = parseNonEmptyString(params.title)
    if (title !== null) {
      args.push("-f", `name=${title}`)
    }

    const notes = parseNonEmptyString(params.notes)
    if (notes !== null) {
      args.push("-f", `body=${notes}`)
    }

    const targetCommitish = parseNonEmptyString(params.targetCommitish)
    if (targetCommitish !== null) {
      args.push("-f", `target_commitish=${targetCommitish}`)
    }

    const prerelease = params.prerelease
    if (typeof prerelease === "boolean") {
      args.push("-F", `prerelease=${prerelease}`)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "release.create", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "release.create", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const normalized = normalizeRelease(data)

    return normalizeResult(normalized, "cli", {
      capabilityId: "release.create",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "release.create", reason: "CARD_FALLBACK" },
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
      { capabilityId: "release.create", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleReleaseUpdate: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "release.update")

    const releaseId = parseStrictPositiveInt(params.releaseId)
    if (releaseId === null) {
      throw new Error("Missing or invalid releaseId for release.update")
    }

    if (params.draft !== undefined && params.draft !== true) {
      throw new Error("release.update only supports draft=true; use release.publish to publish")
    }

    const args = [
      ...commandTokens(card, "api"),
      `repos/${owner}/${name}/releases/${releaseId}`,
      "--method",
      "PATCH",
      "-F",
      "draft=true",
    ]

    const tagName = parseNonEmptyString(params.tagName)
    if (tagName !== null) {
      args.push("-f", `tag_name=${tagName}`)
    }

    const title = parseNonEmptyString(params.title)
    if (title !== null) {
      args.push("-f", `name=${title}`)
    }

    const notes = parseNonEmptyString(params.notes)
    if (notes !== null) {
      args.push("-f", `body=${notes}`)
    }

    const targetCommitish = parseNonEmptyString(params.targetCommitish)
    if (targetCommitish !== null) {
      args.push("-f", `target_commitish=${targetCommitish}`)
    }

    const prerelease = params.prerelease
    if (typeof prerelease === "boolean") {
      args.push("-F", `prerelease=${prerelease}`)
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "release.update", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "release.update", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const normalized = normalizeRelease(data)

    return normalizeResult(normalized, "cli", {
      capabilityId: "release.update",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "release.update", reason: "CARD_FALLBACK" },
      )
    }

    if (error instanceof Error && error.message.includes("only supports draft=true")) {
      return normalizeError(
        { code: errorCodes.Validation, message: error.message, retryable: false },
        "cli",
        { capabilityId: "release.update", reason: "CARD_FALLBACK" },
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
      { capabilityId: "release.update", reason: "CARD_FALLBACK" },
    )
  }
}

export const handleReleasePublishDraft: CliHandler = async (runner, params, card) => {
  try {
    const owner = String(params.owner ?? "")
    const name = String(params.name ?? "")

    requireRepo(owner, name, "release.publish")

    const releaseId = parseStrictPositiveInt(params.releaseId)
    if (releaseId === null) {
      throw new Error("Missing or invalid releaseId for release.publish")
    }

    const readArgs = [...commandTokens(card, "api"), `repos/${owner}/${name}/releases/${releaseId}`]

    const readResult = await runner.run("gh", readArgs, DEFAULT_TIMEOUT_MS)

    if (readResult.exitCode !== 0) {
      const code = mapErrorToCode(readResult.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(readResult.stderr, readResult.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "release.publish", exitCode: readResult.exitCode },
        },
        "cli",
        { capabilityId: "release.publish", reason: "CARD_FALLBACK" },
      )
    }

    const readData = parseCliData(readResult.stdout)
    const readRecord =
      typeof readData === "object" && readData !== null && !Array.isArray(readData)
        ? (readData as Record<string, unknown>)
        : {}

    const isDraft = readRecord.draft === true
    if (!isDraft) {
      return normalizeError(
        {
          code: errorCodes.Validation,
          message: "release.publish requires an existing draft release",
          retryable: false,
        },
        "cli",
        { capabilityId: "release.publish", reason: "CARD_FALLBACK" },
      )
    }

    const publishArgs = [
      ...commandTokens(card, "api"),
      `repos/${owner}/${name}/releases/${releaseId}`,
      "--method",
      "PATCH",
      "-F",
      "draft=false",
    ]

    const title = parseNonEmptyString(params.title)
    if (title !== null) {
      publishArgs.push("-f", `name=${title}`)
    }

    const notes = parseNonEmptyString(params.notes)
    if (notes !== null) {
      publishArgs.push("-f", `body=${notes}`)
    }

    const prerelease = params.prerelease
    if (typeof prerelease === "boolean") {
      publishArgs.push("-F", `prerelease=${prerelease}`)
    }

    const publishResult = await runner.run("gh", publishArgs, DEFAULT_TIMEOUT_MS)

    if (publishResult.exitCode !== 0) {
      const code = mapErrorToCode(publishResult.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(publishResult.stderr, publishResult.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "release.publish", exitCode: publishResult.exitCode },
        },
        "cli",
        { capabilityId: "release.publish", reason: "CARD_FALLBACK" },
      )
    }

    const publishData = parseCliData(publishResult.stdout)
    const normalized = normalizeRelease(publishData)
    const withWasDraft = { ...normalized, wasDraft: true }

    return normalizeResult(withWasDraft, "cli", {
      capabilityId: "release.publish",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "release.publish", reason: "CARD_FALLBACK" },
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
      { capabilityId: "release.publish", reason: "CARD_FALLBACK" },
    )
  }
}

export const handlers: Record<string, CliHandler> = {
  "release.list": handleReleaseList,
  "release.view": handleReleaseGet,
  "release.create": handleReleaseCreateDraft,
  "release.update": handleReleaseUpdate,
  "release.publish": handleReleasePublishDraft,
}
