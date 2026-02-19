/* global console, process */
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

function fixGeneratedImportExtensions(packageRoot) {
  const opsDir = join(packageRoot, "src", "gql", "operations")
  fixGeneratedArtifactsInDir(opsDir)
}

function ensureCommonTypesAliases(packageRoot) {
  const commonTypesPath = join(packageRoot, "src", "gql", "generated", "common-types.generated.ts")
  const content = readFileSync(commonTypesPath, "utf8")

  let next = content
  if (!next.includes("export type PullRequestReviewEvent = string")) {
    next = next.replace(
      "export type PullRequestReviewState = string\n",
      "export type PullRequestReviewState = string\nexport type PullRequestReviewEvent = string\n",
    )
  }

  if (!next.includes("export type DraftPullRequestReviewThread = {")) {
    next = next.replace(
      "export type PullRequestReviewDecision = string\n",
      `export type PullRequestReviewDecision = string

export type DraftPullRequestReviewThread = {
  body: Scalars["String"]["input"]
  line?: InputMaybe<Scalars["Int"]["input"]>
  path?: InputMaybe<Scalars["String"]["input"]>
  side?: InputMaybe<DiffSide>
  startLine?: InputMaybe<Scalars["Int"]["input"]>
  startSide?: InputMaybe<DiffSide>
}
`,
    )
  }

  if (next !== content) {
    writeFileSync(commonTypesPath, next, "utf8")
  }
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
  ensureCommonTypesAliases(packageRoot)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
