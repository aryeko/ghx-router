export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts: number
    backoffMs?: number
    isRetryable?: (err: unknown) => boolean
  },
): Promise<{ result: T; attempts: number }> {
  const { maxAttempts, backoffMs = 0, isRetryable = () => true } = opts

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fn()
      return { result, attempts: attempt }
    } catch (error: unknown) {
      lastError = error

      if (attempt < maxAttempts && isRetryable(error)) {
        const delayMs = backoffMs * attempt
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
        continue
      }

      throw error
    }
  }

  throw lastError
}
