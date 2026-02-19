import { handlers as issueHandlers } from "./domains/issue.js"
import { handlers as prHandlers } from "./domains/pr.js"
import { handlers as projectV2Handlers } from "./domains/project-v2.js"
import { handlers as releaseHandlers } from "./domains/release.js"
import { handlers as repoHandlers } from "./domains/repo.js"
import { handlers as workflowHandlers } from "./domains/workflow.js"
import type { CliHandler } from "./helpers.js"

const ALL_HANDLERS: Record<string, CliHandler> = {
  ...repoHandlers,
  ...issueHandlers,
  ...prHandlers,
  ...workflowHandlers,
  ...projectV2Handlers,
  ...releaseHandlers,
}

export function getCliHandler(capabilityId: string): CliHandler | undefined {
  return ALL_HANDLERS[capabilityId]
}

export function listCliCapabilities(): string[] {
  return Object.keys(ALL_HANDLERS)
}
