import type { CodegenConfig } from "@graphql-codegen/cli"

const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim()

if (!token) {
  throw new Error(
    "gql:schema:refresh requires GITHUB_TOKEN (or GH_TOKEN) to query https://api.github.com/graphql",
  )
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
  generates: {
    "src/gql/schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
  ignoreNoDocuments: true,
} as CodegenConfig

export default config
