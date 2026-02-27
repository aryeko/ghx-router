import { createIssueSeeder } from "./issue-seeder.js"
import { createPrSeeder } from "./pr-seeder.js"
import type { FixtureSeeder } from "./types.js"

const registry = new Map<string, FixtureSeeder>()

export function registerSeeder(seeder: FixtureSeeder): void {
  registry.set(seeder.type, seeder)
}

export function getSeeder(type: string): FixtureSeeder {
  const seeder = registry.get(type)
  if (!seeder) {
    throw new Error(`No seeder registered for type "${type}"`)
  }
  return seeder
}

// Auto-register built-in seeders
registerSeeder(createPrSeeder())
registerSeeder(createIssueSeeder())

export type { FixtureSeeder, SeedOptions } from "./types.js"
