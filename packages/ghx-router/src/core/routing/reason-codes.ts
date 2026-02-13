export const routeReasonCodes = [
  "CARD_PREFERRED",
  "CARD_FALLBACK",
  "PREFLIGHT_FAILED",
  "ENV_CONSTRAINT",
  "CAPABILITY_LIMIT",
  "DEFAULT_POLICY"
] as const

export type RouteReasonCode = (typeof routeReasonCodes)[number]
