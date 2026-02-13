export const routeReasonCodes = [
  "coverage_gap",
  "efficiency_gain",
  "output_shape_requirement"
] as const

export type RouteReasonCode = (typeof routeReasonCodes)[number]
