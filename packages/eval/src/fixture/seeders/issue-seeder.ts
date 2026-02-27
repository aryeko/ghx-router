import { execFile } from "node:child_process"

import type { FixtureResource } from "@eval/fixture/manifest.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

function runGh(args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("gh", args as string[], (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout.trim())
    })
  })
}

export function createIssueSeeder(): FixtureSeeder {
  return {
    type: "issue",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const title = `[bench-fixture] ${options.name}`

      const createArgs = [
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        `Auto-created fixture for eval scenario "${options.name}".`,
        ...options.labels.flatMap((label) => ["--label", label]),
      ]
      await runGh(createArgs)

      const listArgs = [
        "issue",
        "list",
        "--repo",
        options.repo,
        "--label",
        "bench-fixture",
        "--json",
        "number,title",
        "--limit",
        "1",
        "--search",
        title,
      ]
      const listOutput = await runGh(listArgs)
      const issues: readonly { readonly number: number; readonly title: string }[] =
        JSON.parse(listOutput)

      const match = issues.find((i) => i.title === title)
      if (!match) {
        throw new Error(`Could not find issue "${options.name}" after creation in ${options.repo}`)
      }

      return {
        type: "issue",
        number: match.number,
        repo: options.repo,
        labels: [...options.labels],
        metadata: {},
      }
    },
  }
}
