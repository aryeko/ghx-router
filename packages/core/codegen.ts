import type { CodegenConfig } from "@graphql-codegen/cli"

const config = {
  schema: "src/gql/schema.graphql",
  documents: ["src/gql/operations/**/*.graphql"],
  generates: {
    "src/gql/operations/": {
      preset: "near-operation-file",
      presetConfig: {
        extension: ".generated.ts",
        baseTypesPath: "../generated/common-types.generated.js",
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
