import type { Scorer, ScorerContext, ScorerResult } from "../../src/contracts/scorer.js"
import type { BaseScenario } from "../../src/types/scenario.js"

export function createMockScorer(result?: Partial<ScorerResult>): Scorer {
  return {
    id: "mock-scorer",
    async evaluate(_scenario: BaseScenario, _context: ScorerContext): Promise<ScorerResult> {
      return {
        success: true,
        passed: 3,
        total: 3,
        details: [],
        outputValid: true,
        ...result,
      }
    },
  }
}
