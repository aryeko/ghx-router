type Primitive = string | number | boolean | null

type LogValue = Primitive | LogValue[] | { [key: string]: LogValue }

const SENSITIVE_KEY_PATTERN = /(token|authorization|cookie|secret|password|api[_-]?key)/i

function redactValue(value: LogValue): LogValue {
  if (Array.isArray(value)) {
    return value.map(redactValue)
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, LogValue> = {}
    for (const [key, nested] of Object.entries(value)) {
      redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactValue(nested)
    }
    return redacted
  }

  return value
}

export function sanitizeTelemetryContext(
  context: Record<string, LogValue>,
): Record<string, LogValue> {
  return redactValue(context) as Record<string, LogValue>
}

export function logMetric(
  name: string,
  value: number,
  context: Record<string, LogValue> = {},
): void {
  if (process.env.GHX_TELEMETRY_STDOUT !== "1") {
    return
  }

  const payload = {
    timestamp: new Date().toISOString(),
    metric: name,
    value,
    context: sanitizeTelemetryContext(context),
  }

  process.stdout.write(`${JSON.stringify(payload)}\n`)
}
