/** Valid log severity levels in ascending order of verbosity. */
export type LogLevel = "debug" | "info" | "warn" | "error"

/** Minimal structured logger interface used throughout the profiler. */
export interface Logger {
  /**
   * Log a debug-level message.
   * @param message - The message to log.
   * @param args - Additional values to include in the log output.
   */
  debug(message: string, ...args: readonly unknown[]): void
  /**
   * Log an info-level message.
   * @param message - The message to log.
   * @param args - Additional values to include in the log output.
   */
  info(message: string, ...args: readonly unknown[]): void
  /**
   * Log a warning-level message.
   * @param message - The message to log.
   * @param args - Additional values to include in the log output.
   */
  warn(message: string, ...args: readonly unknown[]): void
  /**
   * Log an error-level message.
   * @param message - The message to log.
   * @param args - Additional values to include in the log output.
   */
  error(message: string, ...args: readonly unknown[]): void
}

const LEVEL_ORDER: readonly LogLevel[] = ["debug", "info", "warn", "error"]

/**
 * Create a Logger that filters messages below the specified minimum level.
 *
 * Messages at or above `level` are written to the appropriate `console.*` method
 * with a bracketed severity prefix. Messages below `level` are silently discarded.
 *
 * @param level - Minimum severity level to emit.
 * @returns A Logger instance configured to the specified minimum level.
 */
export function createLogger(level: LogLevel): Logger {
  const minLevel = LEVEL_ORDER.indexOf(level)

  function shouldLog(msgLevel: LogLevel): boolean {
    return LEVEL_ORDER.indexOf(msgLevel) >= minLevel
  }

  return {
    debug(message: string, ...args: readonly unknown[]) {
      if (shouldLog("debug")) console.debug(`[DEBUG] ${message}`, ...args)
    },
    info(message: string, ...args: readonly unknown[]) {
      if (shouldLog("info")) console.info(`[INFO] ${message}`, ...args)
    },
    warn(message: string, ...args: readonly unknown[]) {
      if (shouldLog("warn")) console.warn(`[WARN] ${message}`, ...args)
    },
    error(message: string, ...args: readonly unknown[]) {
      if (shouldLog("error")) console.error(`[ERROR] ${message}`, ...args)
    },
  }
}
