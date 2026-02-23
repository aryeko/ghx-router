import { OpencodeSessionProvider } from "./opencode/provider.js"
import type { SessionProvider } from "./types.js"

export type ProviderConfig = {
  type: "opencode"
  providerId: string
  modelId: string
}

export async function createSessionProvider(config: ProviderConfig): Promise<SessionProvider> {
  switch (config.type) {
    case "opencode":
      return new OpencodeSessionProvider({
        type: "opencode",
        providerId: config.providerId,
        modelId: config.modelId,
      })
    default:
      throw new Error(`Unknown provider type: ${config.type satisfies never}`)
  }
}
