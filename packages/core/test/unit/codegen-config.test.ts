import { describe, expect, it } from "vitest"

describe("codegen config", () => {
  it("uses local schema and operation generation settings", async () => {
    const { default: config } = await import("../../codegen.js")
    const generatedOutput = config.generates["src/gql/operations/"] as {
      plugins?: Array<string>
      preset?: string
      presetConfig?: Record<string, unknown>
    }

    expect(config.schema).toBe("src/gql/schema.graphql")
    expect(config.documents).toEqual(["src/gql/operations/**/*.graphql"])
    expect(generatedOutput.preset).toBe("near-operation-file")
    expect(generatedOutput.presetConfig).toEqual(
      expect.objectContaining({
        extension: ".generated.ts",
        baseTypesPath: "../generated/common-types.generated.js",
      }),
    )
    expect(generatedOutput.plugins).toEqual(["typescript-operations", "typescript-graphql-request"])
  })
})
