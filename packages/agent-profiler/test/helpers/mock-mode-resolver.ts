import type { ModeConfig, ModeResolver } from "../../src/contracts/mode-resolver.js"

export function createMockModeResolver(
  configs?: Record<string, Partial<ModeConfig>>,
): ModeResolver {
  return {
    async resolve(mode: string): Promise<ModeConfig> {
      const override = configs?.[mode]
      return {
        environment: {},
        systemInstructions: `System instructions for ${mode}`,
        providerOverrides: {},
        ...override,
      }
    },
  }
}
