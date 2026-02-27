import type {
  CreateSessionParams,
  PromptResult,
  ProviderConfig,
  SessionHandle,
  SessionProvider,
} from "../../src/contracts/provider.js"
import type { SessionTrace } from "../../src/types/trace.js"
import { makePromptResult, makeSessionHandle, makeSessionTrace } from "./factories.js"

export function createMockProvider(overrides?: {
  promptResult?: PromptResult
  sessionTrace?: SessionTrace
}): SessionProvider & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {
    init: [],
    createSession: [],
    prompt: [],
    exportSession: [],
    destroySession: [],
    shutdown: [],
  }

  function track(method: string, args: unknown[]) {
    const list = calls[method]
    if (list) list.push(args)
  }

  return {
    id: "mock-provider",
    calls,
    async init(config: ProviderConfig) {
      track("init", [config])
    },
    async createSession(params: CreateSessionParams) {
      track("createSession", [params])
      return makeSessionHandle()
    },
    async prompt(handle: SessionHandle, text: string, timeoutMs?: number) {
      track("prompt", [handle, text, timeoutMs])
      return overrides?.promptResult ?? makePromptResult()
    },
    async exportSession(handle: SessionHandle) {
      track("exportSession", [handle])
      return overrides?.sessionTrace ?? makeSessionTrace()
    },
    async destroySession(handle: SessionHandle) {
      track("destroySession", [handle])
    },
    async shutdown() {
      track("shutdown", [])
    },
  }
}
