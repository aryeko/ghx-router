export const routeReasonCodes = [
  "INPUT_VALIDATION",
  "OUTPUT_VALIDATION",
  "CARD_PREFERRED",
  "CARD_FALLBACK",
  "PREFLIGHT_FAILED",
  "ENV_CONSTRAINT",
  "CAPABILITY_LIMIT",
  "DEFAULT_POLICY"
] as const

export type RouteReasonCode = (typeof routeReasonCodes)[number]
