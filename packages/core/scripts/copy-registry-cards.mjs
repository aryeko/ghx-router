import { cp, mkdir, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(scriptDir)
const sourceDir = join(packageRoot, "src/core/registry/cards")
const targetDirs = [join(packageRoot, "dist/cards"), join(packageRoot, "dist/core/registry/cards")]
const sourceSkillAssetsDir = join(packageRoot, "src/cli/assets/skills")
const targetSkillAssetsDir = join(packageRoot, "dist/cli/assets/skills")

for (const targetDir of targetDirs) {
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: true })
}

await rm(targetSkillAssetsDir, { recursive: true, force: true })
await mkdir(targetSkillAssetsDir, { recursive: true })
await cp(sourceSkillAssetsDir, targetSkillAssetsDir, { recursive: true, force: true })
