/* global process */
import { execSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const checkMode = process.argv.includes("--check")

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(scriptDir)
const repoRoot = join(packageRoot, "..", "..")

const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"))
const repoUrl = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")

const pluginDescription =
  "GitHub execution router for AI agents — 66 capabilities with deterministic routing and normalized output"

const pluginJson = {
  name: "ghx",
  description: pluginDescription,
  version: pkg.version,
  author: { name: typeof pkg.author === "string" ? pkg.author : (pkg.author?.name ?? "") },
  repository: repoUrl,
  homepage: repoUrl,
  license: pkg.license,
  keywords: ["github", "ai-agents", "cli", "automation"],
}

const marketplaceJson = {
  name: "ghx",
  owner: { name: typeof pkg.author === "string" ? pkg.author : (pkg.author?.name ?? "") },
  plugins: [
    {
      name: "ghx",
      source: { source: "npm", package: pkg.name },
    },
  ],
}

const manifests = [
  { path: join(packageRoot, ".claude-plugin", "plugin.json"), content: pluginJson },
  { path: join(repoRoot, ".claude-plugin", "marketplace.json"), content: marketplaceJson },
]

if (checkMode) {
  let drifted = false
  for (const { path, content } of manifests) {
    let actual
    try {
      actual = JSON.parse(await readFile(path, "utf8"))
    } catch {
      process.stderr.write(`Missing: ${path}\n`)
      drifted = true
      continue
    }
    if (JSON.stringify(actual) !== JSON.stringify(content)) {
      process.stderr.write(`Out of sync: ${path}\n`)
      drifted = true
    }
  }
  if (drifted) {
    process.stderr.write("Run: pnpm --filter @ghx-dev/core run plugin:sync\n")
    process.exit(1)
  }
  process.stdout.write("Plugin manifests in sync.\n")
} else {
  for (const { path, content } of manifests) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(content, null, 2) + "\n", "utf8")
  }
  execSync("biome check --write .claude-plugin/", { cwd: packageRoot, stdio: "inherit" })
  process.stdout.write("Plugin manifests synced.\n")
}
