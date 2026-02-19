/* global console, process */
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

function fixGeneratedImportExtensions(packageRoot) {
  const opsDir = join(packageRoot, "src", "gql", "operations")
  fixGeneratedArtifactsInDir(opsDir)
}

function fixGeneratedArtifactsInDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      fixGeneratedArtifactsInDir(entryPath)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith(".generated.ts")) {
      continue
    }

    const content = readFileSync(entryPath, "utf8")
    const fixedImports = content.replace(/from '(\.\.?\/[^']+?)(?<!\.js)'/g, "from '$1.js'")
    // GitHub's GraphQL schema introspection varies by token capabilities for a few thread types.
    // Normalize these members to keep generated artifacts stable across local and CI tokens.
    const fixed = fixedImports
      .replace(/^\s+\| { __typename\?: ["']NotificationThread["'] }\r?$/gm, "")
      .replace(/^\s+\| { __typename\?: ["']RepositoryDependabotAlertsThread["'] }\r?$/gm, "")
    if (fixed !== content) {
      writeFileSync(entryPath, fixed, "utf8")
    }
  }
}

async function main() {
  const packageRoot = resolve(process.cwd())

  const result = spawnSync("pnpm", ["exec", "graphql-codegen", "--config", "codegen.ts"], {
    cwd: packageRoot,
    stdio: "inherit",
  })

  if (result.status !== 0) {
    throw new Error(`GraphQL code generation failed with status ${result.status ?? "unknown"}`)
  }

  fixGeneratedImportExtensions(packageRoot)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
