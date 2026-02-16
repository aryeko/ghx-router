import type { CodegenConfig } from "@graphql-codegen/cli"

const token = process.env.GITHUB_TOKEN

if (!token) {
  throw new Error("GITHUB_TOKEN is required for GraphQL code generation")
}

const config = {
  schema: [
    {
      "https://api.github.com/graphql": {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  ],
  documents: ["src/gql/operations/**/*.graphql"],
  generates: {
    "src/gql/operations/": {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".generated.ts",
        baseTypesPath: "../generated/common-types.js",
      },
      plugins: ["typescript-operations", "typescript-graphql-request"],
      config: {
        useTypeImports: true,
        documentMode: "string",
        preResolveTypes: true,
        onlyOperationTypes: true,
        emitLegacyCommonJSImports: false,
        rawRequest: false,
      },
    },
  },
  ignoreNoDocuments: false,
} as CodegenConfig

export default config
