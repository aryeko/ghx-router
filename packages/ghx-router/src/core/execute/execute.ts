import type { ErrorCode } from "../errors/codes.js"
import { errorCodes } from "../errors/codes.js"
import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { OperationCard } from "../registry/types.js"
import { validateInput, validateOutput } from "../registry/schema-validator.js"
import { normalizeError } from "../execution/normalizer.js"
import { logMetric } from "../telemetry/logger.js"

type PreflightResult =
  | { ok: true }
  | { ok: false; code: ErrorCode; message: string; retryable: boolean; details?: Record<string, unknown> }

type ExecuteOptions = {
  card: OperationCard
  params: Record<string, unknown>
  routingContext?: Record<string, unknown>
  trace?: boolean
  retry?: {
    maxAttemptsPerRoute?: number
  }
  preflight: (route: RouteSource) => Promise<PreflightResult>
  routes: Record<RouteSource, (params: Record<string, unknown>) => Promise<ResultEnvelope>>
}

function parsePredicateValue(raw: string): unknown {
  const value = raw.trim()
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  if (value === "null") {
    return null
  }

  const numeric = Number(value)
  if (!Number.isNaN(numeric) && value.length > 0) {
    return numeric
  }

  return value.replace(/^['"]|['"]$/g, "")
}

function resolvePathValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".").filter((segment) => segment.length > 0)
  let current: unknown = source

  for (const segment of segments) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function evaluateSuitabilityPreferred(
  card: OperationCard,
  params: Record<string, unknown>,
  routingContext: Record<string, unknown>
): RouteSource {
  const rules = card.routing.suitability ?? []

  for (const rule of rules) {
    const alwaysMatch = /^(cli|graphql|rest)$/i.exec(rule.predicate.trim())
    const alwaysRoute = alwaysMatch?.[1]
    if (rule.when === "always" && alwaysRoute) {
      return alwaysRoute.toLowerCase() as RouteSource
    }

    const conditionalMatch = /^(cli|graphql|rest)\s+if\s+([a-zA-Z0-9_.]+)\s*(==|!=)\s*(.+)$/i.exec(
      rule.predicate.trim()
    )

    if (!conditionalMatch) {
      continue
    }

    const [, targetRouteRaw = "", rawPath = "", operator = "==", rawExpected = ""] = conditionalMatch
    const targetRoute = targetRouteRaw.toLowerCase() as RouteSource
    const source = rule.when === "env" ? routingContext : params
    const path = rawPath.startsWith("params.") || rawPath.startsWith("env.")
      ? rawPath.split(".").slice(1).join(".")
      : rawPath
    const actual = resolvePathValue(source, path)
    const expected = parsePredicateValue(rawExpected)
    const matches = operator === "==" ? actual === expected : actual !== expected

    if (matches) {
      return targetRoute
    }
  }

  return card.routing.preferred
}

function routePlan(
  card: OperationCard,
  params: Record<string, unknown>,
  routingContext: Record<string, unknown>
): RouteSource[] {
  const preferred = evaluateSuitabilityPreferred(card, params, routingContext)
  const planned = new Set<RouteSource>([preferred, ...card.routing.fallbacks])
  return [...planned]
}

export async function execute(options: ExecuteOptions): Promise<ResultEnvelope> {
  const inputValidation = validateInput(options.card.input_schema, options.params)
  if (!inputValidation.ok) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: "Input schema validation failed",
        retryable: false,
        details: { ajvErrors: inputValidation.errors }
      },
      options.card.routing.preferred,
      {
        capabilityId: options.card.capability_id,
        reason: "INPUT_VALIDATION"
      }
    )
  }

  const attempts: NonNullable<ResultEnvelope["meta"]["attempts"]> = []
  const maxAttemptsPerRoute = Math.max(1, options.retry?.maxAttemptsPerRoute ?? 1)
  let lastError: ResultEnvelope["error"]
  let firstError: ResultEnvelope["error"]

  const routingContext = options.routingContext ?? {}

  for (const route of routePlan(options.card, options.params, routingContext)) {
    logMetric("route.plan", 1, {
      capability_id: options.card.capability_id,
      route
    })

    const preflight = await options.preflight(route)
    if (!preflight.ok) {
      logMetric("route.preflight_skipped", 1, {
        capability_id: options.card.capability_id,
        route,
        error_code: preflight.code
      })
      attempts.push({ route, status: "skipped", error_code: preflight.code })
      lastError = {
        code: preflight.code,
        message: preflight.message,
        retryable: preflight.retryable,
        ...(preflight.details ? { details: preflight.details } : {})
      }
      firstError ??= lastError
      continue
    }

    const routeHandler = options.routes[route]
    if (typeof routeHandler !== "function") {
      logMetric("route.missing_handler", 1, {
        capability_id: options.card.capability_id,
        route
      })

      const handlerError = {
        code: errorCodes.AdapterUnsupported,
        message: `No route handler configured for '${route}'`,
        retryable: false,
        details: { route }
      }

      attempts.push({ route, status: "skipped", error_code: errorCodes.AdapterUnsupported })
      lastError = handlerError
      firstError ??= handlerError
      continue
    }

    for (let attempt = 0; attempt < maxAttemptsPerRoute; attempt += 1) {
      const result = await routeHandler(options.params)
      logMetric("route.attempt", 1, {
        capability_id: options.card.capability_id,
        route,
        ok: result.ok
      })
      const attemptRecord: { route: RouteSource; status: "success" | "error"; error_code?: ErrorCode } = {
        route,
        status: result.ok ? "success" : "error"
      }
      if (result.error?.code) {
        attemptRecord.error_code = result.error.code
      }
      attempts.push(attemptRecord)

      if (result.ok) {
        const outputValidation = validateOutput(options.card.output_schema, result.data)
        if (!outputValidation.ok) {
          const envelope = normalizeError(
            {
              code: errorCodes.Server,
              message: "Output schema validation failed",
              retryable: false,
              details: { ajvErrors: outputValidation.errors }
            },
            route,
            {
              capabilityId: options.card.capability_id,
              reason: "OUTPUT_VALIDATION"
            }
          )

          if (options.trace) {
            envelope.meta.attempts = attempts
          }

          return envelope
        }

        if (options.trace) {
          result.meta.attempts = attempts
        }
        return result
      }

      lastError = result.error
      firstError ??= result.error
      if (!result.error?.retryable) {
        if (result.error?.code !== errorCodes.AdapterUnsupported) {
          if (options.trace) {
            result.meta.attempts = attempts
          }
          return result
        }
        break
      }
    }
  }

  const finalError = lastError ?? firstError ?? {
    code: errorCodes.Unknown,
    message: "No route produced a result",
    retryable: false
  }

  const envelope = normalizeError(finalError, options.card.routing.preferred, {
    capabilityId: options.card.capability_id,
    reason: "CARD_FALLBACK"
  })

  if (options.trace) {
    envelope.meta.attempts = attempts
  }

  return envelope
}
