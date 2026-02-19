import { afterEach, describe, expect, it, vi } from "vitest"

async function importFreshConfig() {
  vi.resetModules()
  return import("../../codegen-schema.js")
}

describe("codegen schema update config", () => {
  const originalGithubToken = process.env.GITHUB_TOKEN
  const originalGhToken = process.env.GH_TOKEN

  afterEach(() => {
    if (originalGithubToken === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = originalGithubToken
    }
    if (originalGhToken === undefined) {
      delete process.env.GH_TOKEN
    } else {
      process.env.GH_TOKEN = originalGhToken
    }
  })

  it("throws a clear error when no token is available", async () => {
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN

    await expect(importFreshConfig()).rejects.toThrow(
      "gql:schema:refresh requires GITHUB_TOKEN (or GH_TOKEN)",
    )
  })

  it("uses GH_TOKEN when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = "gh-token"

    const { default: config } = await importFreshConfig()
    const schemaConfig = config.schema as Array<
      Record<string, { headers: { Authorization: string } }>
    >
    const target = schemaConfig[0]?.["https://api.github.com/graphql"]

    expect(target).toBeDefined()
    expect(target?.headers.Authorization).toBe("Bearer gh-token")
    expect(config.generates["src/gql/schema.graphql"]).toEqual(
      expect.objectContaining({
        plugins: ["schema-ast"],
      }),
    )
  })
})
