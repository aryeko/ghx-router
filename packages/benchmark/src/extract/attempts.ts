type AttemptMeta = {
  route?: string
  status?: string
  error_code?: string
}

type ExtractedAttempts = {
  totalAttempts: number
  routeUsed: string | null
  retryCount: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function extractAttemptMetrics(payload: unknown): ExtractedAttempts {
  if (!isObject(payload) || !isObject(payload.meta)) {
    return { totalAttempts: 0, routeUsed: null, retryCount: 0 }
  }

  const routeUsed = typeof payload.meta.route_used === "string" ? payload.meta.route_used : null
  const attempts = Array.isArray(payload.meta.attempts)
    ? payload.meta.attempts.filter((attempt): attempt is AttemptMeta => isObject(attempt))
    : []

  const errorAttempts = attempts.filter((attempt) => attempt.status === "error").length

  return {
    totalAttempts: attempts.length,
    routeUsed,
    retryCount: errorAttempts,
  }
}
