import { readFile, writeFile } from "node:fs/promises"
import { z } from "zod"

export const FixtureResourceSchema = z.object({
  /** Resource type identifier, e.g. `"pr"` or `"issue"`. */
  type: z.string(),
  /** GitHub issue or PR number. */
  number: z.number(),
  /** Full `"owner/repo"` string for the fixture repository. */
  repo: z.string(),
  /** Associated branch name, if the fixture involves a PR branch. */
  branch: z.string().optional(),
  /** Labels applied to the GitHub resource for identification and cleanup. */
  labels: z.array(z.string()).optional(),
  /** Arbitrary metadata; `originalSha` is used by {@link FixtureManager} to reset branches. */
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const FixtureManifestSchema = z.object({
  /** Identifier for the seed run that created this manifest. */
  seedId: z.string(),
  /** ISO-8601 timestamp of when the manifest was created. */
  createdAt: z.string(),
  /** GitHub repo containing all fixtures in `"owner/repo"` format. */
  repo: z.string(),
  /** Map of fixture name → resource details. Keys match scenario `fixture.requires` entries. */
  fixtures: z.record(z.string(), FixtureResourceSchema),
})

/**
 * Describes the set of GitHub fixture resources created for an eval seed run.
 *
 * Load with {@link loadFixtureManifest} and persist with {@link writeFixtureManifest}.
 * The `fixtures` map keys match the `requires` entries in each scenario's `fixture` block.
 */
export type FixtureManifest = z.infer<typeof FixtureManifestSchema>
export type FixtureResource = z.infer<typeof FixtureResourceSchema>

/**
 * Reads and validates a fixture manifest from a JSON file.
 *
 * @param path - Absolute or relative path to the manifest JSON file
 * @returns Validated {@link FixtureManifest}
 * @throws {Error} When the file does not exist or fails schema validation
 *
 * @example
 * ```typescript
 * import { loadFixtureManifest } from "@ghx-dev/eval"
 *
 * const manifest = await loadFixtureManifest("fixtures/latest.json")
 * console.log(manifest.seedId, manifest.repo)
 * ```
 */
export async function loadFixtureManifest(path: string): Promise<FixtureManifest> {
  const content = await readFile(path, "utf-8")
  return FixtureManifestSchema.parse(JSON.parse(content))
}

/**
 * Serializes a fixture manifest to a JSON file, creating parent directories
 * as needed.
 *
 * @param path - Path to write the manifest JSON
 * @param manifest - Manifest to serialize
 *
 * @example
 * ```typescript
 * import { writeFixtureManifest } from "@ghx-dev/eval"
 *
 * await writeFixtureManifest("fixtures/latest.json", manifest)
 * ```
 */
export async function writeFixtureManifest(path: string, manifest: FixtureManifest): Promise<void> {
  await writeFile(path, JSON.stringify(manifest, null, 2), "utf-8")
}
