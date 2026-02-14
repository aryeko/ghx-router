import { cp, mkdir, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(scriptDir)
const sourceDir = join(packageRoot, "src/core/registry/cards")
const targetDirs = [join(packageRoot, "dist/cards"), join(packageRoot, "dist/core/registry/cards")]

for (const targetDir of targetDirs) {
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: true })
}
