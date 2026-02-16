import { describe, expect, it } from "vitest"

import {
  createExecuteTool,
  explainCapability,
  listCapabilities,
  MAIN_SKILL_TEXT,
} from "../../src/agent.js"
import {
  createGithubClient,
  createGithubClientFromToken,
  createGraphqlClient,
  createSafeCliCommandRunner,
  executeTask,
} from "../../src/index.js"

describe("public exports", () => {
  it("exports root api surface", () => {
    expect(typeof executeTask).toBe("function")
    expect(typeof createGithubClient).toBe("function")
    expect(typeof createGithubClientFromToken).toBe("function")
    expect(typeof createGraphqlClient).toBe("function")
    expect(typeof createSafeCliCommandRunner).toBe("function")
  })

  it("exports agent api surface", () => {
    expect(typeof createExecuteTool).toBe("function")
    expect(typeof explainCapability).toBe("function")
    expect(typeof listCapabilities).toBe("function")
    expect(typeof MAIN_SKILL_TEXT).toBe("string")
    expect(MAIN_SKILL_TEXT.length).toBeGreaterThan(0)
  })
})
