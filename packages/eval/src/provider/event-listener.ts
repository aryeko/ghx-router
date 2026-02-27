export class TimeoutError extends Error {
  constructor(
    readonly sessionId: string,
    readonly timeoutMs: number,
  ) {
    super(`Session ${sessionId} timed out after ${timeoutMs}ms`)
    this.name = "TimeoutError"
  }
}
