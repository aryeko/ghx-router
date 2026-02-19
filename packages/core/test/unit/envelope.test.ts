import type {
  ChainResultEnvelope,
  ChainStatus,
  ChainStepResult,
} from "@core/core/contracts/envelope.js"
import { describe, expect, it } from "vitest"

describe("ChainResultEnvelope types", () => {
  it("status type accepts valid values", () => {
    const s1: ChainStatus = "success"
    const s2: ChainStatus = "partial"
    const s3: ChainStatus = "failed"
    expect([s1, s2, s3]).toHaveLength(3)
  })

  it("ChainStepResult can be ok", () => {
    const r: ChainStepResult = { task: "issue.close", ok: true, data: { id: "x" } }
    expect(r.ok).toBe(true)
  })

  it("ChainResultEnvelope has expected shape", () => {
    const env: ChainResultEnvelope = {
      status: "success",
      results: [{ task: "issue.close", ok: true }],
      meta: { route_used: "graphql", total: 1, succeeded: 1, failed: 0 },
    }
    expect(env.meta.total).toBe(1)
  })
})
