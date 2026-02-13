import { describe, expect, it } from "vitest"

import { MAIN_SKILL_TEXT } from "../../src/agent-interface/prompt/main-skill.js"
import { main } from "../../src/cli/index.js"
import { doctorCommand } from "../../src/cli/commands/doctor.js"
import { routesCommand } from "../../src/cli/commands/routes.js"
import { runCommand } from "../../src/cli/commands/run.js"
import { formatJson } from "../../src/cli/formatters/json.js"
import { formatTable } from "../../src/cli/formatters/table.js"
import { issueCommentsListTask } from "../../src/core/contracts/tasks/issue.comments.list.js"
import { issueListTask } from "../../src/core/contracts/tasks/issue.list.js"
import { issueViewTask } from "../../src/core/contracts/tasks/issue.view.js"
import { prListTask } from "../../src/core/contracts/tasks/pr.list.js"
import { prViewTask } from "../../src/core/contracts/tasks/pr.view.js"
import { repoViewTask } from "../../src/core/contracts/tasks/repo.view.js"
import { routeReasonCodes } from "../../src/core/routing/reason-codes.js"
import { runRestAdapter } from "../../src/core/execution/adapters/rest-adapter.js"
import { projectName } from "../../src/shared/constants.js"
import { isObject } from "../../src/shared/utils.js"

describe("scaffolds and constants", () => {
  it("keeps main skill prompt text stable", () => {
    expect(MAIN_SKILL_TEXT).toContain("execute(capability_id, params)")
    expect(MAIN_SKILL_TEXT).toContain("ResultEnvelope")
  })

  it("executes scaffold command entrypoints without throwing", () => {
    expect(() => main()).not.toThrow()
    expect(() => doctorCommand()).not.toThrow()
    expect(() => routesCommand()).not.toThrow()
    expect(() => runCommand()).not.toThrow()
  })

  it("formats simple outputs", () => {
    expect(formatJson({ a: 1 })).toContain("\"a\": 1")
    expect(formatTable([{ a: 1 }])).toContain("not implemented")
  })

  it("exposes task identifiers and routing reasons", () => {
    expect(issueCommentsListTask.id).toBe("issue.comments.list")
    expect(issueListTask.id).toBe("issue.list")
    expect(issueViewTask.id).toBe("issue.view")
    expect(prListTask.id).toBe("pr.list")
    expect(prViewTask.id).toBe("pr.view")
    expect(repoViewTask.id).toBe("repo.view")
    expect(routeReasonCodes).toContain("CARD_FALLBACK")
  })

  it("exports shared utility primitives", () => {
    expect(projectName).toBe("ghx-router")
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
  })

  it("throws for unimplemented rest adapter", async () => {
    await expect(runRestAdapter()).rejects.toThrow("not implemented")
  })
})
