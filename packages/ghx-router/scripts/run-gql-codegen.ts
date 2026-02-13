import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { resolveGithubToken } from "./get-github-token.js"

async function main(): Promise<void> {
  const token = await resolveGithubToken()
  const packageRoot = resolve(process.cwd())

  const result = spawnSync(
    "pnpm",
    ["exec", "graphql-codegen", "--config", "codegen.ts"],
    {
      cwd: packageRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        GITHUB_TOKEN: token
      }
    }
  )

  if (result.status !== 0) {
    throw new Error(`GraphQL code generation failed with status ${result.status ?? "unknown"}`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
