import { describe, expect, it } from "vitest"

import { resolveGithubToken } from "../../scripts/get-github-token.js"

describe("resolveGithubToken", () => {
  it("uses GITHUB_TOKEN from environment when present", async () => {
    const token = await resolveGithubToken({
      env: { GITHUB_TOKEN: " env-token " },
      getToken: async () => "gh-token"
    })

    expect(token).toBe("env-token")
  })

  it("falls back to gh token resolver when env token missing", async () => {
    const token = await resolveGithubToken({
      env: {},
      getToken: async () => "gh-token"
    })

    expect(token).toBe("gh-token")
  })

  it("throws when no token source yields a value", async () => {
    await expect(
      resolveGithubToken({
        env: {},
        getToken: async () => "   "
      })
    ).rejects.toThrow("GitHub token not available")
  })
})
