/** Resolved configuration for a specific execution mode. */
export interface ModeConfig {
  /** Environment variables to inject when running in this mode. */
  readonly environment: Readonly<Record<string, string>>
  /** System instructions prepended to the agent context for this mode. */
  readonly systemInstructions: string
  /** Provider-specific overrides (e.g., model, temperature) applied in this mode. */
  readonly providerOverrides: Readonly<Record<string, unknown>>
}

/** Resolve a mode name to its full configuration. */
export interface ModeResolver {
  /**
   * Resolve a named execution mode to its configuration.
   * @param mode - The mode identifier to resolve (e.g., "ghx", "agent_direct").
   * @returns The resolved configuration for the specified mode.
   */
  resolve(mode: string): Promise<ModeConfig>
}
