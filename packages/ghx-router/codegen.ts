import type { CodegenConfig } from "@graphql-codegen/cli"

const token = process.env.GITHUB_TOKEN

if (!token) {
  throw new Error("GITHUB_TOKEN is required for GraphQL code generation")
}

const config: CodegenConfig = {
  schema: [
    {
      "https://api.github.com/graphql": {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  ],
  documents: ["src/gql/operations/**/*.graphql"],
  generates: {
    "src/gql/generated/graphql.ts": {
      plugins: ["typescript", "typescript-operations", "typescript-graphql-request"],
      config: {
        documentMode: "string",
        useTypeImports: true
      }
    }
  },
  ignoreNoDocuments: false
}

export default config
