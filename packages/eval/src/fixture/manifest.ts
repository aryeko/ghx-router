import { readFile, writeFile } from "node:fs/promises"
import { z } from "zod"

export const FixtureResourceSchema = z.object({
  type: z.string(),
  number: z.number(),
  repo: z.string(),
  branch: z.string().optional(),
  labels: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const FixtureManifestSchema = z.object({
  seedId: z.string(),
  createdAt: z.string(),
  repo: z.string(),
  fixtures: z.record(z.string(), FixtureResourceSchema),
})

export type FixtureManifest = z.infer<typeof FixtureManifestSchema>
export type FixtureResource = z.infer<typeof FixtureResourceSchema>

export async function loadFixtureManifest(path: string): Promise<FixtureManifest> {
  const content = await readFile(path, "utf-8")
  return FixtureManifestSchema.parse(JSON.parse(content))
}

export async function writeFixtureManifest(path: string, manifest: FixtureManifest): Promise<void> {
  await writeFile(path, JSON.stringify(manifest, null, 2), "utf-8")
}
