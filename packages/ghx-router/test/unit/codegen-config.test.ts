import { describe, expect, it } from "vitest"

describe("codegen config", () => {
  it("uses operations folder and graphql-request sdk plugin", async () => {
    process.env.GITHUB_TOKEN = "test-token"
    const { default: config } = await import("../../codegen.js")
    const generatedOutput = config.generates["src/gql/generated/graphql.ts"] as {
      plugins?: string[]
    }

    expect(config.documents).toEqual(["src/gql/operations/**/*.graphql"])
    expect(generatedOutput.plugins).toEqual([
      "typescript",
      "typescript-operations",
      "typescript-graphql-request"
    ])
  })
})
