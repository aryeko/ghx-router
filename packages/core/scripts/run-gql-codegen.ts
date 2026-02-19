import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { resolveGithubToken } from "./get-github-token.js"

function fixGeneratedImportExtensions(packageRoot: string): void {
  const opsDir = join(packageRoot, "src", "gql", "operations")
  fixGeneratedArtifactsInDir(opsDir)

  const fragmentsDir = join(opsDir, "fragments")
  try {
    readdirSync(fragmentsDir)
  } catch {
    // fragments directory may not exist yet
    return
  }
  fixGeneratedArtifactsInDir(fragmentsDir)
}

function fixGeneratedArtifactsInDir(dir: string): void {
  const files = readdirSync(dir).filter((f) => f.endsWith(".generated.ts"))

  for (const file of files) {
    const filePath = join(dir, file)
    const content = readFileSync(filePath, "utf8")
    const fixedImports = content.replace(/from '(\.\.?\/[^']+?)(?<!\.js)'/g, "from '$1.js'")
    // GitHub's GraphQL schema introspection varies by token capabilities for a few thread types.
    // Normalize these members to keep generated artifacts stable across local and CI tokens.
    const fixed = fixedImports
      .replace(/^\s+\| { __typename\?: ["']NotificationThread["'] }\r?$/gm, "")
      .replace(/^\s+\| { __typename\?: ["']RepositoryDependabotAlertsThread["'] }\r?$/gm, "")
    if (fixed !== content) {
      writeFileSync(filePath, fixed, "utf8")
    }
  }
}

async function main(): Promise<void> {
  const token = await resolveGithubToken()
  const packageRoot = resolve(process.cwd())

  const result = spawnSync("pnpm", ["exec", "graphql-codegen", "--config", "codegen.ts"], {
    cwd: packageRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      GITHUB_TOKEN: token,
    },
  })

  if (result.status !== 0) {
    throw new Error(`GraphQL code generation failed with status ${result.status ?? "unknown"}`)
  }

  fixGeneratedImportExtensions(packageRoot)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
