import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "../../../normalizer.js"
import type { CliHandler } from "../helpers.js"
import {
  DEFAULT_TIMEOUT_MS,
  normalizeProjectV2Summary,
  parseCliData,
  parseListFirst,
  parseNonEmptyString,
  parseStrictPositiveInt,
  sanitizeCliErrorMessage,
} from "../helpers.js"

const handleProjectV2OrgGet: CliHandler = async (runner, params, _card) => {
  try {
    const owner = parseNonEmptyString(params.org)
    if (owner === null) {
      throw new Error("Missing or invalid org for project_v2.org.get")
    }

    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    if (projectNumber === null) {
      throw new Error("Missing or invalid projectNumber for project_v2.org.get")
    }

    const args = ["project", "view", String(projectNumber), "--owner", owner, "--format", "json"]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "project_v2.org.get", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "project_v2.org.get", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const normalized = normalizeProjectV2Summary(data)

    return normalizeResult(normalized, "cli", {
      capabilityId: "project_v2.org.get",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "project_v2.org.get", reason: "CARD_FALLBACK" },
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
      { capabilityId: "project_v2.org.get", reason: "CARD_FALLBACK" },
    )
  }
}

const handleProjectV2UserGet: CliHandler = async (runner, params, _card) => {
  try {
    const user = parseNonEmptyString(params.user)
    if (user === null) {
      throw new Error("Missing or invalid user for project_v2.user.get")
    }

    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    if (projectNumber === null) {
      throw new Error("Missing or invalid projectNumber for project_v2.user.get")
    }

    const args = ["project", "view", String(projectNumber), "--owner", user, "--format", "json"]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "project_v2.user.get", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "project_v2.user.get", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const normalized = normalizeProjectV2Summary(data)

    return normalizeResult(normalized, "cli", {
      capabilityId: "project_v2.user.get",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "project_v2.user.get", reason: "CARD_FALLBACK" },
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
      { capabilityId: "project_v2.user.get", reason: "CARD_FALLBACK" },
    )
  }
}

const handleProjectV2FieldsList: CliHandler = async (runner, params, _card) => {
  try {
    const projectOwner = parseNonEmptyString(params.owner)
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    if (projectOwner === null || projectNumber === null) {
      throw new Error("Missing or invalid owner/projectNumber for project_v2.fields.list")
    }

    const args = [
      "project",
      "field-list",
      String(projectNumber),
      "--owner",
      projectOwner,
      "--format",
      "json",
    ]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "project_v2.fields.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "project_v2.fields.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const fields = Array.isArray(root.fields) ? root.fields : []

    const normalized = {
      items: fields.map((field) => {
        if (typeof field !== "object" || field === null || Array.isArray(field)) {
          return { id: null, name: null, dataType: null }
        }
        const record = field as Record<string, unknown>
        return {
          id: typeof record.id === "string" ? record.id : null,
          name: typeof record.name === "string" ? record.name : null,
          dataType: typeof record.dataType === "string" ? record.dataType : null,
        }
      }),
      pageInfo: { hasNextPage: false, endCursor: null },
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "project_v2.fields.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "project_v2.fields.list", reason: "CARD_FALLBACK" },
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
      { capabilityId: "project_v2.fields.list", reason: "CARD_FALLBACK" },
    )
  }
}

const handleProjectV2ItemsList: CliHandler = async (runner, params, _card) => {
  try {
    const projectOwner = parseNonEmptyString(params.owner)
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    const first = parseListFirst(params.first)
    if (projectOwner === null || projectNumber === null || first === null) {
      throw new Error("Missing or invalid owner/projectNumber/first for project_v2.items.list")
    }

    const args = [
      "project",
      "item-list",
      String(projectNumber),
      "--owner",
      projectOwner,
      "--format",
      "json",
      "--limit",
      String(first),
    ]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "project_v2.items.list", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "project_v2.items.list", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}
    const items = Array.isArray(root.items) ? root.items : []

    const normalized = {
      items: items.map((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return { id: null, contentType: null, contentNumber: null, contentTitle: null }
        }
        const record = item as Record<string, unknown>
        const content =
          typeof record.content === "object" &&
          record.content !== null &&
          !Array.isArray(record.content)
            ? (record.content as Record<string, unknown>)
            : {}
        return {
          id: typeof record.id === "string" ? record.id : null,
          contentType: typeof content.type === "string" ? content.type : null,
          contentNumber: typeof content.number === "number" ? content.number : null,
          contentTitle: typeof content.title === "string" ? content.title : null,
        }
      }),
      pageInfo: { hasNextPage: false, endCursor: null },
    }

    return normalizeResult(normalized, "cli", {
      capabilityId: "project_v2.items.list",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "project_v2.items.list", reason: "CARD_FALLBACK" },
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
      { capabilityId: "project_v2.items.list", reason: "CARD_FALLBACK" },
    )
  }
}

const handleProjectV2ItemAddIssue: CliHandler = async (runner, params, _card) => {
  try {
    const projectOwner = parseNonEmptyString(params.owner)
    const projectNumber = parseStrictPositiveInt(params.projectNumber)
    const issueUrl = parseNonEmptyString(params.issueUrl)
    if (projectOwner === null || projectNumber === null || issueUrl === null) {
      throw new Error(
        "Missing or invalid owner/projectNumber/issueUrl for project_v2.item.add_issue",
      )
    }

    const args = [
      "project",
      "item-add",
      String(projectNumber),
      "--owner",
      projectOwner,
      "--url",
      issueUrl,
      "--format",
      "json",
    ]

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "project_v2.item.add_issue", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "project_v2.item.add_issue", reason: "CARD_FALLBACK" },
      )
    }

    const data = parseCliData(result.stdout)
    const root =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {}

    const normalized = { itemId: typeof root.id === "string" ? root.id : null, added: true }

    return normalizeResult(normalized, "cli", {
      capabilityId: "project_v2.item.add_issue",
      reason: "CARD_FALLBACK",
    })
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return normalizeError(
        { code: errorCodes.Server, message: "Failed to parse CLI JSON output", retryable: false },
        "cli",
        { capabilityId: "project_v2.item.add_issue", reason: "CARD_FALLBACK" },
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
      { capabilityId: "project_v2.item.add_issue", reason: "CARD_FALLBACK" },
    )
  }
}

const handleProjectV2ItemFieldUpdate: CliHandler = async (runner, params, _card) => {
  try {
    const projectId = parseNonEmptyString(params.projectId)
    const itemId = parseNonEmptyString(params.itemId)
    const fieldId = parseNonEmptyString(params.fieldId)
    if (projectId === null || itemId === null || fieldId === null) {
      throw new Error(
        "Missing or invalid projectId/itemId/fieldId for project_v2.item.field.update",
      )
    }

    const args = [
      "project",
      "item-edit",
      "--project-id",
      projectId,
      "--id",
      itemId,
      "--field-id",
      fieldId,
    ]

    // Priority: valueText > valueNumber (finite) > valueDate > valueSingleSelectOptionId > valueIterationId > clear===true
    const valueText = parseNonEmptyString(params.valueText)
    if (valueText !== null) {
      args.push("--text", valueText)
    } else {
      const valueNumber = params.valueNumber
      if (typeof valueNumber === "number" && Number.isFinite(valueNumber)) {
        args.push("--number", String(valueNumber))
      } else {
        const valueDate = parseNonEmptyString(params.valueDate)
        if (valueDate !== null) {
          args.push("--date", valueDate)
        } else {
          const valueSingleSelectOptionId = parseNonEmptyString(params.valueSingleSelectOptionId)
          if (valueSingleSelectOptionId !== null) {
            args.push("--single-select-option-id", valueSingleSelectOptionId)
          } else {
            const valueIterationId = parseNonEmptyString(params.valueIterationId)
            if (valueIterationId !== null) {
              args.push("--iteration-id", valueIterationId)
            } else {
              const clear = params.clear === true
              if (clear) {
                args.push("--clear")
              } else {
                throw new Error("Missing field value update for project_v2.item.field.update")
              }
            }
          }
        }
      }
    }

    const result = await runner.run("gh", args, DEFAULT_TIMEOUT_MS)

    if (result.exitCode !== 0) {
      const code = mapErrorToCode(result.stderr)
      return normalizeError(
        {
          code,
          message: sanitizeCliErrorMessage(result.stderr, result.exitCode),
          retryable: isRetryableErrorCode(code),
          details: { capabilityId: "project_v2.item.field.update", exitCode: result.exitCode },
        },
        "cli",
        { capabilityId: "project_v2.item.field.update", reason: "CARD_FALLBACK" },
      )
    }

    const normalized = { itemId, updated: true }

    return normalizeResult(normalized, "cli", {
      capabilityId: "project_v2.item.field.update",
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
      { capabilityId: "project_v2.item.field.update", reason: "CARD_FALLBACK" },
    )
  }
}

export const handlers: Record<string, CliHandler> = {
  "project_v2.org.get": handleProjectV2OrgGet,
  "project_v2.user.get": handleProjectV2UserGet,
  "project_v2.fields.list": handleProjectV2FieldsList,
  "project_v2.items.list": handleProjectV2ItemsList,
  "project_v2.item.add_issue": handleProjectV2ItemAddIssue,
  "project_v2.item.field.update": handleProjectV2ItemFieldUpdate,
}
