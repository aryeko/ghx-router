# Composite Capabilities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add composite capabilities that batch multiple GitHub operations into single tool calls and single GraphQL requests using aliases, reducing agent round-trips and API calls.

**Architecture:** New `composite` field on `OperationCard` type + new `buildBatchMutation()` engine in `gql/batch.ts` + composite execution path in `engine.ts`. Composite cards (`.composite` suffix) coexist alongside atomic cards. Enhanced `pr.review.submit` gets a new GraphQL route with inline comments support.

**Tech Stack:** TypeScript strict ESM, Vitest, GraphQL string manipulation, AJV JSON schema validation

**Worktree:** `.worktrees/composite-capabilities` (branch: `feat/composite-capabilities`)

**Run all commands from:** `<LOCAL_WORKTREE_PATH>`

---

## Task List

### Task 1: Extend OperationCard Types

**Files:**
- Modify: `packages/core/src/core/registry/types.ts`

**Step 1: Write the failing test**

Create `packages/core/test/unit/composite-types.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import type { CompositeConfig, CompositeStep, OperationCard } from "../../src/core/registry/types.js"

describe("CompositeConfig types", () => {
  it("allows OperationCard with composite field", () => {
    const card: OperationCard = {
      capability_id: "pr.threads.composite",
      version: "1.0.0",
      description: "Batch thread operations",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      composite: {
        steps: [
          {
            capability_id: "pr.thread.reply",
            foreach: "threads",
            params_map: { threadId: "threadId", body: "body" },
          },
        ],
        output_strategy: "array",
      },
    }
    expect(card.composite).toBeDefined()
    expect(card.composite!.steps).toHaveLength(1)
    expect(card.composite!.output_strategy).toBe("array")
  })

  it("allows OperationCard without composite field", () => {
    const card: OperationCard = {
      capability_id: "repo.view",
      version: "1.0.0",
      description: "View repo",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
    }
    expect(card.composite).toBeUndefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/composite-types.test.ts`
Expected: FAIL — `CompositeConfig` and `CompositeStep` types don't exist yet

**Step 3: Write minimal implementation**

Add to `packages/core/src/core/registry/types.ts`:

```typescript
export interface CompositeStep {
  capability_id: string
  foreach?: string
  params_map: Record<string, string>
}

export interface CompositeConfig {
  steps: CompositeStep[]
  output_strategy: "merge" | "array" | "last"
}
```

Add `composite?: CompositeConfig` to the `OperationCard` interface.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/composite-types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/core/registry/types.ts packages/core/test/unit/composite-types.test.ts
git commit -m "feat: add CompositeConfig types to OperationCard"
```

---

### Task 2: Update Operation Card JSON Schema

**Files:**
- Modify: `packages/core/src/core/registry/operation-card-schema.ts`
- Modify: `packages/core/test/unit/registry-validation.test.ts`

**Step 1: Write the failing test**

Add test cases to `packages/core/test/unit/registry-validation.test.ts`:

```typescript
it("accepts card with valid composite config", () => {
  const card = {
    ...validBaseCard,
    capability_id: "pr.threads.composite",
    composite: {
      steps: [
        {
          capability_id: "pr.thread.reply",
          foreach: "threads",
          params_map: { threadId: "threadId" },
        },
      ],
      output_strategy: "array",
    },
  }
  const result = validateOperationCard(card)
  expect(result).toEqual({ ok: true })
})

it("rejects card with invalid output_strategy", () => {
  const card = {
    ...validBaseCard,
    composite: {
      steps: [{ capability_id: "pr.thread.reply", params_map: {} }],
      output_strategy: "invalid",
    },
  }
  const result = validateOperationCard(card)
  expect(result.ok).toBe(false)
})

it("rejects composite with empty steps array", () => {
  const card = {
    ...validBaseCard,
    composite: {
      steps: [],
      output_strategy: "array",
    },
  }
  const result = validateOperationCard(card)
  expect(result.ok).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/registry-validation.test.ts -t "composite"`
Expected: FAIL — composite field rejected by `additionalProperties: false`

**Step 3: Write minimal implementation**

Add `composite` property to `operation-card-schema.ts` inside the `properties` object (before the closing of `properties`):

```typescript
composite: {
  type: "object",
  required: ["steps", "output_strategy"],
  properties: {
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["capability_id", "params_map"],
        properties: {
          capability_id: { type: "string", minLength: 1 },
          foreach: { type: "string", minLength: 1 },
          params_map: { type: "object" },
        },
        additionalProperties: false,
      },
    },
    output_strategy: { enum: ["merge", "array", "last"] },
  },
  additionalProperties: false,
},
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/registry-validation.test.ts`
Expected: PASS (all existing + new tests)

**Step 5: Commit**

```bash
git add packages/core/src/core/registry/operation-card-schema.ts packages/core/test/unit/registry-validation.test.ts
git commit -m "feat: add composite config to operation card schema"
```

---

### Task 3: Build GraphQL Alias Batching Engine

**Files:**
- Create: `packages/core/src/gql/batch.ts`
- Create: `packages/core/test/unit/gql-batch.test.ts`

This is the core new module. It takes inline GQL mutation strings + variables, prefixes aliases and variable names, and combines them into one mutation string.

**Step 1: Write the failing test**

Create `packages/core/test/unit/gql-batch.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import { buildBatchMutation } from "../../src/gql/batch.js"

describe("buildBatchMutation", () => {
  const REPLY_MUTATION = `
    mutation PrCommentReply($threadId: ID!, $body: String!) {
      addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
        comment { id }
      }
    }
  `

  const RESOLVE_MUTATION = `
    mutation PrCommentResolve($threadId: ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id isResolved }
      }
    }
  `

  it("combines two operations with aliases and prefixed variables", () => {
    const result = buildBatchMutation([
      {
        alias: "reply0",
        mutation: REPLY_MUTATION,
        variables: { threadId: "t1", body: "Fixed" },
      },
      {
        alias: "resolve0",
        mutation: RESOLVE_MUTATION,
        variables: { threadId: "t1" },
      },
    ])

    // Check merged variables are prefixed
    expect(result.variables).toEqual({
      reply0_threadId: "t1",
      reply0_body: "Fixed",
      resolve0_threadId: "t1",
    })

    // Check document contains aliased selections
    expect(result.document).toContain("reply0: addPullRequestReviewThreadReply")
    expect(result.document).toContain("resolve0: resolveReviewThread")

    // Check variable references are prefixed
    expect(result.document).toContain("$reply0_threadId")
    expect(result.document).toContain("$reply0_body")
    expect(result.document).toContain("$resolve0_threadId")

    // Check it's a single mutation
    expect(result.document).toMatch(/^mutation BatchComposite\(/)
  })

  it("handles single operation", () => {
    const result = buildBatchMutation([
      {
        alias: "op0",
        mutation: RESOLVE_MUTATION,
        variables: { threadId: "t1" },
      },
    ])
    expect(result.variables).toEqual({ op0_threadId: "t1" })
    expect(result.document).toContain("op0: resolveReviewThread")
  })

  it("throws on empty operations array", () => {
    expect(() => buildBatchMutation([])).toThrow()
  })

  it("preserves selection set structure (nested fields)", () => {
    const result = buildBatchMutation([
      {
        alias: "r0",
        mutation: RESOLVE_MUTATION,
        variables: { threadId: "t1" },
      },
    ])
    expect(result.document).toContain("thread { id isResolved }")
    // or at minimum contains "thread" and "isResolved"
    expect(result.document).toContain("thread")
    expect(result.document).toContain("isResolved")
  })

  it("handles multiple operations of the same type with different aliases", () => {
    const result = buildBatchMutation([
      { alias: "resolve0", mutation: RESOLVE_MUTATION, variables: { threadId: "t1" } },
      { alias: "resolve1", mutation: RESOLVE_MUTATION, variables: { threadId: "t2" } },
      { alias: "resolve2", mutation: RESOLVE_MUTATION, variables: { threadId: "t3" } },
    ])

    expect(result.variables).toEqual({
      resolve0_threadId: "t1",
      resolve1_threadId: "t2",
      resolve2_threadId: "t3",
    })
    expect(result.document).toContain("resolve0: resolveReviewThread")
    expect(result.document).toContain("resolve1: resolveReviewThread")
    expect(result.document).toContain("resolve2: resolveReviewThread")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/gql-batch.test.ts`
Expected: FAIL — module `../../src/gql/batch.js` does not exist

**Step 3: Write minimal implementation**

Create `packages/core/src/gql/batch.ts`:

The implementation must:
1. Parse each mutation string to extract: variable declarations (name + type), the mutation body (the selection inside `mutation Name(...) { HERE }`), and rewrite `$varName` references to `$alias_varName`
2. Combine all aliased selections into a single `mutation BatchComposite(...)` document
3. Merge variables with prefixed keys

Use string parsing (regex), not the `graphql` AST library — keeps it lightweight and avoids importing the full graphql parser at runtime. The mutations in the codebase are simple, predictable strings.

Key parsing steps:
- Extract variable declarations from `mutation Name($var1: Type!, $var2: Type!)` header
- Extract the body between the outermost `{ ... }` after the header (the selection set)
- For the body, find the top-level field name (e.g. `addPullRequestReviewThreadReply`) and prefix it with the alias
- Replace all `$varName` references in the body with `$alias_varName`

```typescript
import type { GraphqlVariables } from "./client.js"

export type BatchOperationInput = {
  alias: string
  mutation: string
  variables: GraphqlVariables
}

export type BatchMutationResult = {
  document: string
  variables: GraphqlVariables
}

export function buildBatchMutation(operations: BatchOperationInput[]): BatchMutationResult {
  if (operations.length === 0) {
    throw new Error("buildBatchMutation requires at least one operation")
  }

  const allVarDeclarations: string[] = []
  const allSelections: string[] = []
  const mergedVariables: GraphqlVariables = {}

  for (const op of operations) {
    const parsed = parseMutation(op.mutation)

    // Prefix variable declarations
    for (const varDecl of parsed.variableDeclarations) {
      allVarDeclarations.push(`$${op.alias}_${varDecl.name}: ${varDecl.type}`)
    }

    // Prefix variable references in body and add alias
    let body = parsed.body
    for (const varDecl of parsed.variableDeclarations) {
      body = body.replaceAll(`$${varDecl.name}`, `$${op.alias}_${varDecl.name}`)
    }

    // Add alias prefix to the top-level field
    const aliasedBody = body.replace(
      /^\s*(\w+)/,
      `${op.alias}: $1`,
    )
    allSelections.push(aliasedBody)

    // Prefix variable values
    for (const [key, value] of Object.entries(op.variables)) {
      mergedVariables[`${op.alias}_${key}`] = value
    }
  }

  const document = `mutation BatchComposite(${allVarDeclarations.join(", ")}) {\n${allSelections.join("\n")}\n}`

  return { document, variables: mergedVariables }
}

type VariableDeclaration = { name: string; type: string }
type ParsedMutation = { variableDeclarations: VariableDeclaration[]; body: string }

function parseMutation(mutation: string): ParsedMutation {
  // Extract variable declarations from header: mutation Name($var1: Type!, $var2: Type!)
  const headerMatch = mutation.match(/mutation\s+\w+\s*\(([^)]*)\)/)
  const variableDeclarations: VariableDeclaration[] = []

  if (headerMatch?.[1]) {
    const varString = headerMatch[1]
    const varMatches = varString.matchAll(/\$(\w+)\s*:\s*([^,)]+)/g)
    for (const match of varMatches) {
      variableDeclarations.push({
        name: match[1]!,
        type: match[2]!.trim(),
      })
    }
  }

  // Extract body: everything between the outermost { } after the header
  const headerEnd = mutation.indexOf("{")
  if (headerEnd === -1) {
    throw new Error("Invalid mutation: no opening brace found")
  }

  let depth = 0
  let bodyStart = -1
  let bodyEnd = -1
  for (let i = headerEnd; i < mutation.length; i++) {
    if (mutation[i] === "{") {
      if (depth === 0) bodyStart = i + 1
      depth++
    } else if (mutation[i] === "}") {
      depth--
      if (depth === 0) {
        bodyEnd = i
        break
      }
    }
  }

  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error("Invalid mutation: unbalanced braces")
  }

  const body = mutation.slice(bodyStart, bodyEnd).trim()
  return { variableDeclarations, body }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/gql-batch.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/gql/batch.ts packages/core/test/unit/gql-batch.test.ts
git commit -m "feat: add GraphQL alias batching engine"
```

---

### Task 4: Extract Operation Builders from Client Methods

**Files:**
- Create: `packages/core/src/gql/builders.ts`
- Create: `packages/core/test/unit/gql-builders.test.ts`
- Modify: `packages/core/src/gql/client.ts` (refactor `run*` methods to use builders internally)

Refactor existing client mutation methods into a build/map split so composites can reuse the same logic. Each builder extracts the validation + variable assembly (`build`) and response parsing (`mapResponse`) from the corresponding `run*` method.

**Step 1: Write the failing test**

Create `packages/core/test/unit/gql-builders.test.ts`:

```typescript
import { describe, expect, it } from "vitest"
import {
  OPERATION_BUILDERS,
  type OperationBuilder,
} from "../../src/gql/builders.js"

describe("OperationBuilder registry", () => {
  it("has a builder for pr.thread.reply", () => {
    const builder = OPERATION_BUILDERS["pr.thread.reply"]
    expect(builder).toBeDefined()
  })

  it("has a builder for pr.thread.resolve", () => {
    const builder = OPERATION_BUILDERS["pr.thread.resolve"]
    expect(builder).toBeDefined()
  })

  it("has a builder for pr.thread.unresolve", () => {
    const builder = OPERATION_BUILDERS["pr.thread.unresolve"]
    expect(builder).toBeDefined()
  })
})

describe("pr.thread.reply builder", () => {
  const builder = OPERATION_BUILDERS["pr.thread.reply"]!

  it("build() returns mutation string and variables", () => {
    const result = builder.build({ threadId: "t1", body: "Fixed" })
    expect(result.mutation).toContain("addPullRequestReviewThreadReply")
    expect(result.variables).toEqual({ threadId: "t1", body: "Fixed" })
  })

  it("build() throws when body is missing", () => {
    expect(() => builder.build({ threadId: "t1" })).toThrow()
  })

  it("mapResponse() extracts comment id", () => {
    const raw = {
      addPullRequestReviewThreadReply: { comment: { id: "c1" } },
    }
    const result = builder.mapResponse(raw)
    expect(result).toEqual({ id: "c1" })
  })
})

describe("pr.thread.resolve builder", () => {
  const builder = OPERATION_BUILDERS["pr.thread.resolve"]!

  it("build() returns mutation string and variables", () => {
    const result = builder.build({ threadId: "t1" })
    expect(result.mutation).toContain("resolveReviewThread")
    expect(result.variables).toEqual({ threadId: "t1" })
  })

  it("mapResponse() extracts thread state", () => {
    const raw = {
      resolveReviewThread: { thread: { id: "t1", isResolved: true } },
    }
    const result = builder.mapResponse(raw)
    expect(result).toEqual({ id: "t1", isResolved: true })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/gql-builders.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Write minimal implementation**

Create `packages/core/src/gql/builders.ts`:

```typescript
import type { GraphqlVariables } from "./client.js"

export type BuiltOperation = {
  mutation: string
  variables: GraphqlVariables
}

export type OperationBuilder = {
  /** May be async for multi-step operations (e.g., issue.labels.update does a lookup first) */
  build: (input: Record<string, unknown>) => BuiltOperation | Promise<BuiltOperation>
  mapResponse: (raw: unknown) => unknown
}

// Import mutation string constants from client.ts
// IMPORTANT: These constants are currently unexported in client.ts.
// Add `export` to each constant declaration in client.ts before creating this file:
//   export const PR_COMMENT_REPLY_MUTATION = ...
//   export const PR_COMMENT_RESOLVE_MUTATION = ...
//   export const PR_COMMENT_UNRESOLVE_MUTATION = ...
import {
  PR_COMMENT_REPLY_MUTATION,
  PR_COMMENT_RESOLVE_MUTATION,
  PR_COMMENT_UNRESOLVE_MUTATION,
} from "./client.js"

const replyBuilder: OperationBuilder = {
  build(input) {
    if (!input.threadId || typeof input.threadId !== "string") {
      throw new Error("threadId is required")
    }
    if (!input.body || typeof input.body !== "string") {
      throw new Error("body is required for reply")
    }
    return {
      mutation: PR_COMMENT_REPLY_MUTATION,
      variables: { threadId: input.threadId, body: input.body },
    }
  },
  mapResponse(raw) {
    // Reuses same parsing logic as runReplyToReviewThread
    const root = raw as Record<string, unknown>
    const mutation = root?.addPullRequestReviewThreadReply as Record<string, unknown>
    const comment = mutation?.comment as Record<string, unknown>
    return { id: comment?.id }
  },
}

const resolveBuilder: OperationBuilder = {
  build(input) {
    if (!input.threadId || typeof input.threadId !== "string") {
      throw new Error("threadId is required")
    }
    return {
      mutation: PR_COMMENT_RESOLVE_MUTATION,
      variables: { threadId: input.threadId },
    }
  },
  mapResponse(raw) {
    const root = raw as Record<string, unknown>
    const mutation = root?.resolveReviewThread as Record<string, unknown>
    const thread = mutation?.thread as Record<string, unknown>
    return { id: thread?.id, isResolved: thread?.isResolved }
  },
}

const unresolveBuilder: OperationBuilder = {
  build(input) {
    if (!input.threadId || typeof input.threadId !== "string") {
      throw new Error("threadId is required")
    }
    return {
      mutation: PR_COMMENT_UNRESOLVE_MUTATION,
      variables: { threadId: input.threadId },
    }
  },
  mapResponse(raw) {
    const root = raw as Record<string, unknown>
    const mutation = root?.unresolveReviewThread as Record<string, unknown>
    const thread = mutation?.thread as Record<string, unknown>
    return { id: thread?.id, isResolved: thread?.isResolved }
  },
}

export const OPERATION_BUILDERS: Record<string, OperationBuilder> = {
  "pr.thread.reply": replyBuilder,
  "pr.thread.resolve": resolveBuilder,
  "pr.thread.unresolve": unresolveBuilder,
  // Issue builders added in Task 6 when those composites need them
}
```

Then refactor `client.ts` `run*` methods to delegate to builders internally:

```typescript
// In runReplyToReviewThread:
async function runReplyToReviewThread(graphqlClient, input) {
  const { mutation, variables } = replyBuilder.build(input)
  const result = await graphqlClient.query(mutation, variables)
  return replyBuilder.mapResponse(result)
}
```

This ensures atomic calls and composite calls use **identical** build + map logic.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/gql-builders.test.ts`
Then: `pnpm --filter @ghx-dev/core exec vitest run` (full suite — verify no regressions from refactoring `run*` methods)
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/gql/builders.ts packages/core/src/gql/client.ts packages/core/test/unit/gql-builders.test.ts
git commit -m "feat: extract operation builders from client methods for composite reuse"
```

---

### Task 5: Create pr.threads.composite Capability Card

**Files:**
- Create: `packages/core/src/core/registry/cards/pr.threads.composite.yaml`
- Modify: `packages/core/src/core/registry/index.ts` (update preferredOrder)

**Step 1: Write the failing test**

Add to `packages/core/test/unit/capability-registry.test.ts` (or create a focused test):

```typescript
it("loads pr.threads.composite card with composite config", () => {
  const card = getOperationCard("pr.threads.composite")
  expect(card).toBeDefined()
  expect(card!.composite).toBeDefined()
  expect(card!.routing.preferred).toBe("graphql")
  expect(card!.composite!.output_strategy).toBe("array")
  expect(card!.composite!.steps.length).toBeGreaterThan(0)
})

it("lists pr.threads.composite before pr.view", () => {
  const cards = listOperationCards()
  const compositeIdx = cards.findIndex((c) => c.capability_id === "pr.threads.composite")
  const viewIdx = cards.findIndex((c) => c.capability_id === "pr.view")
  expect(compositeIdx).toBeLessThan(viewIdx)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/capability-registry.test.ts -t "composite"`
Expected: FAIL — card doesn't exist

**Step 3: Write card YAML**

Create `packages/core/src/core/registry/cards/pr.threads.composite.yaml`:

```yaml
capability_id: pr.threads.composite
version: "1.0.0"
description: "Reply to, resolve, unresolve, or reply-and-resolve multiple PR review threads in a single batched call. Supports mixed actions per thread."
input_schema:
  type: object
  required: [threads]
  properties:
    threads:
      type: array
      minItems: 1
      items:
        type: object
        required: [threadId, action]
        properties:
          threadId:
            type: string
            minLength: 1
          action:
            type: string
            enum: [reply, resolve, reply_and_resolve, unresolve]
          body:
            type: string
            minLength: 1
        additionalProperties: false
  additionalProperties: false
output_schema:
  type: object
  required: [results]
  properties:
    results:
      type: array
      items:
        type: object
        properties:
          threadId:
            type: string
          action:
            type: string
          ok:
            type: boolean
          error:
            type: string
        additionalProperties: false
  additionalProperties: false
routing:
  preferred: graphql
  fallbacks: []
composite:
  steps:
    # Available builders — expansion selects per thread based on action field
    - capability_id: pr.thread.reply
      foreach: threads
      params_map:
        threadId: threadId
        body: body
    - capability_id: pr.thread.resolve
      foreach: threads
      params_map:
        threadId: threadId
    - capability_id: pr.thread.unresolve
      foreach: threads
      params_map:
        threadId: threadId
  output_strategy: array
```

The `action` field on each thread item controls which step(s) execute for that item (see `expandCompositeSteps()` in Task 7).

Update `packages/core/src/core/registry/index.ts` — insert `"pr.threads.composite"` as the first item in the `pr` domain section of `preferredOrder` (before `"pr.view"`):

```typescript
// In the preferredOrder array, add before "pr.view":
"pr.threads.composite",
"pr.view",
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/capability-registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/core/registry/cards/pr.threads.composite.yaml packages/core/src/core/registry/index.ts packages/core/test/unit/capability-registry.test.ts
git commit -m "feat: add pr.threads.composite capability card"
```

---

### Task 6: Create issue.triage.composite and issue.update.composite Cards

**Files:**
- Create: `packages/core/src/core/registry/cards/issue.triage.composite.yaml`
- Create: `packages/core/src/core/registry/cards/issue.update.composite.yaml`
- Modify: `packages/core/src/core/registry/index.ts` (update preferredOrder)

**Step 1: Write the failing test**

Add to registry tests:

```typescript
it("loads issue.triage.composite card", () => {
  const card = getOperationCard("issue.triage.composite")
  expect(card).toBeDefined()
  expect(card!.composite).toBeDefined()
  expect(card!.routing.preferred).toBe("graphql")
  expect(card!.composite!.output_strategy).toBe("merge")
})

it("loads issue.update.composite card", () => {
  const card = getOperationCard("issue.update.composite")
  expect(card).toBeDefined()
  expect(card!.composite).toBeDefined()
})

it("lists issue composites before issue.view", () => {
  const cards = listOperationCards()
  const triageIdx = cards.findIndex((c) => c.capability_id === "issue.triage.composite")
  const updateCompIdx = cards.findIndex((c) => c.capability_id === "issue.update.composite")
  const viewIdx = cards.findIndex((c) => c.capability_id === "issue.view")
  expect(triageIdx).toBeLessThan(viewIdx)
  expect(updateCompIdx).toBeLessThan(viewIdx)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/capability-registry.test.ts -t "issue.*composite"`
Expected: FAIL

**Step 3: Write card YAMLs**

> **Note on `issueId`:** These composites accept the GitHub node ID directly (`issueId`). Agents obtain this from a prior `issue.view` call (which returns the node ID). This matches the pattern of `pr.threads.composite` where agents get thread IDs from `pr.reviews.list`. If we later want `owner/name/issueNumber` input, the composite expansion can do a lookup — but for v1, node IDs keep it simple.

Create `packages/core/src/core/registry/cards/issue.triage.composite.yaml`:

```yaml
capability_id: issue.triage.composite
version: "1.0.0"
description: "Set labels and add a comment to an issue in a single batched call. Requires the issue's node ID (from issue.view)."
input_schema:
  type: object
  required: [issueId]
  properties:
    issueId:
      type: string
      minLength: 1
    labels:
      type: array
      items:
        type: string
        minLength: 1
    body:
      type: string
      minLength: 1
  additionalProperties: false
output_schema:
  type: object
  properties:
    labels:
      type: array
      items:
        type: string
    comment:
      type: object
      properties:
        id:
          type: string
        body:
          type: string
        url:
          type: string
      additionalProperties: false
  additionalProperties: false
routing:
  preferred: graphql
  fallbacks: []
composite:
  steps:
    - capability_id: issue.labels.update
      params_map:
        issueId: issueId
        labels: labels
    - capability_id: issue.comments.create
      params_map:
        issueId: issueId
        body: body
  output_strategy: merge
```

Create `packages/core/src/core/registry/cards/issue.update.composite.yaml`:

```yaml
capability_id: issue.update.composite
version: "1.0.0"
description: "Update issue fields, labels, assignees, and milestone in a single batched call. Provide only the fields you want to change. Requires the issue's node ID (from issue.view)."
input_schema:
  type: object
  required: [issueId]
  properties:
    issueId:
      type: string
      minLength: 1
    title:
      type: string
    body:
      type: string
    labels:
      type: array
      items:
        type: string
        minLength: 1
    assignees:
      type: array
      items:
        type: string
        minLength: 1
    milestoneNumber:
      type: [integer, "null"]
  additionalProperties: false
output_schema:
  type: object
  properties:
    id:
      type: string
    labels:
      type: array
      items:
        type: string
    assignees:
      type: array
      items:
        type: string
    milestoneNumber:
      type: [integer, "null"]
  additionalProperties: false
routing:
  preferred: graphql
  fallbacks: []
composite:
  steps:
    - capability_id: issue.update
      params_map:
        issueId: issueId
        title: title
        body: body
    - capability_id: issue.labels.update
      params_map:
        issueId: issueId
        labels: labels
    - capability_id: issue.assignees.update
      params_map:
        issueId: issueId
        assignees: assignees
    - capability_id: issue.milestone.set
      params_map:
        issueId: issueId
        milestoneNumber: milestoneNumber
  output_strategy: merge
```

**Step 3b: Add issue builders to `gql/builders.ts`**

The issue composite steps reference builders that don't exist yet. Add stubs to `builders.ts` (the mutation constants will need to be identified from `client.ts` or created):

```typescript
// Issue builders — add to OPERATION_BUILDERS registry:
// "issue.labels.update": issueLabelsUpdateBuilder,
// "issue.comments.create": issueCommentCreateBuilder,
// "issue.update": issueUpdateBuilder,
// "issue.assignees.update": issueAssigneesUpdateBuilder,
// "issue.milestone.set": issueMilestoneSetBuilder,
//
// Each follows the same pattern as PR builders: build() returns
// { mutation, variables }, mapResponse() extracts typed output.
// The exact mutation constants and response shapes should be
// extracted from the corresponding run* methods in client.ts.
```

Update `preferredOrder` in `index.ts` — insert composites before `"issue.view"`:

```typescript
"issue.triage.composite",
"issue.update.composite",
"issue.view",
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/capability-registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/core/registry/cards/issue.triage.composite.yaml packages/core/src/core/registry/cards/issue.update.composite.yaml packages/core/src/core/registry/index.ts packages/core/test/unit/capability-registry.test.ts
git commit -m "feat: add issue.triage.composite and issue.update.composite cards"
```

---

### Task 7: Wire Composite Execution into Engine

**Files:**
- Create: `packages/core/src/core/execute/composite.ts`
- Modify: `packages/core/src/core/routing/engine.ts`
- Create: `packages/core/test/unit/composite-engine.test.ts`

This is the integration point — `executeTask()` detects composite cards, uses builders from Task 4 to build per-step operations, batches them, executes once, then maps responses back through each builder's `mapResponse`.

**Step 1: Write the failing test**

Create `packages/core/test/unit/composite-engine.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("composite execution in engine", () => {
  it("dispatches pr.threads.composite via builders and sends single GQL request", async () => {
    // Mock the GraphQL transport to capture the query
    const transportExecute = vi.fn().mockResolvedValue({
      reply0: { addPullRequestReviewThreadReply: { comment: { id: "c1" } } },
      resolve0: { resolveReviewThread: { thread: { id: "t1", isResolved: true } } },
    })

    // ... set up executeTask with a mock GithubClient backed by transportExecute
    // Call executeTask with task: "pr.threads.composite"
    // Assert: transportExecute called exactly once
    // Assert: the query string contains "reply0:" and "resolve0:" aliases
    // Assert: result.ok === true
    // Assert: result.data.results is an array with mapped responses from builders
  })

  it("returns error envelope when batch mutation fails", async () => {
    // Mock transport to throw
    // Assert: result.ok === false, result.error.code is set
  })

  it("falls through to normal execute for non-composite cards", async () => {
    // Call executeTask with task: "repo.view"
    // Assert: normal single-operation flow is used (transport called with non-aliased query)
  })
})
```

Note: The exact test implementation will depend on how the composite path is wired. The implementer should mock the `GraphqlTransport.execute` method and verify:
1. It's called exactly once for composite cards (not N times)
2. The query string contains alias prefixes
3. Results are mapped through each builder's `mapResponse()`

**Step 2: Implement composite step expansion**

Create `packages/core/src/core/execute/composite.ts`:

This module expands a composite card's `steps` + `foreach` + `params_map` into a flat list of built operations using the `OPERATION_BUILDERS` registry from `gql/builders.ts`.

For `pr.threads.composite` with mixed actions, the expansion logic:
1. Iterates over the `threads` array from input
2. For each thread, determines which builder(s) to call based on `action`
3. Calls `builder.build(stepInput)` for each — reusing existing validation + variable assembly
4. Collects `{ alias, mutation, variables, mapResponse }` tuples
5. Returns the list for the batch engine

```typescript
import type { BatchOperationInput } from "../../gql/batch.js"
import { OPERATION_BUILDERS, type OperationBuilder } from "../../gql/builders.js"
import type { CompositeConfig, CompositeStep } from "../registry/types.js"

export type ExpandedOperation = BatchOperationInput & {
  mapResponse: (raw: unknown) => unknown
}

/**
 * Maps action values to the capability_ids that should execute for that action.
 * Used by composites with per-item action routing (e.g., pr.threads.composite).
 */
const ACTION_TO_CAPABILITIES: Record<string, string[]> = {
  reply: ["pr.thread.reply"],
  resolve: ["pr.thread.resolve"],
  reply_and_resolve: ["pr.thread.reply", "pr.thread.resolve"],
  unresolve: ["pr.thread.unresolve"],
}

export async function expandCompositeSteps(
  composite: CompositeConfig,
  input: Record<string, unknown>,
): Promise<ExpandedOperation[]> {
  const operations: ExpandedOperation[] = []

  // Build a map of capability_id → step config for param mapping lookup
  const stepsByCapId = new Map<string, CompositeStep>()
  for (const step of composite.steps) {
    stepsByCapId.set(step.capability_id, step)
  }

  // Determine iteration: if any step has foreach, iterate over that array
  const foreachKey = composite.steps.find((s) => s.foreach)?.foreach
  const items = foreachKey
    ? (input[foreachKey] as Record<string, unknown>[])
    : [input]

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!

    // Action-aware: if item has an `action` field, select builders by action
    const action = item.action as string | undefined
    const capabilityIds = action
      ? (ACTION_TO_CAPABILITIES[action] ?? [])
      : composite.steps.map((s) => s.capability_id)

    for (const capId of capabilityIds) {
      const builder = OPERATION_BUILDERS[capId]
      if (!builder) {
        throw new Error(`No builder registered for capability: ${capId}`)
      }
      const step = stepsByCapId.get(capId)
      if (!step) continue

      // Map item fields to builder input via params_map
      const stepInput: Record<string, unknown> = {}
      for (const [builderParam, itemField] of Object.entries(step.params_map)) {
        stepInput[builderParam] = item[itemField]
      }

      const built = await builder.build(stepInput)
      const aliasBase = capId.split(".").pop() ?? capId
      operations.push({
        alias: `${aliasBase}${i}`,
        mutation: built.mutation,
        variables: built.variables,
        mapResponse: builder.mapResponse,
      })
    }
  }

  return operations
}
```

**Step 3: Wire into engine**

In `packages/core/src/core/routing/engine.ts`, modify `executeTask()`:

```typescript
// After loading the card and before calling execute():
if (card.composite) {
  return executeComposite(card, request.input as Record<string, unknown>, deps)
}
// ... existing execute() call
```

The `executeComposite()` function:
1. Calls `expandCompositeSteps(card, input)` — uses builders to build each operation
2. Extracts `{ alias, mutation, variables }` from expanded operations
3. Calls `buildBatchMutation()` to combine into single document
4. Executes single GQL request via `deps.githubClient.query()`
5. For each aliased result, calls the corresponding `mapResponse()` from the builder
6. Aggregates results per `card.composite.output_strategy`
7. Returns `ResultEnvelope`

**Step 4: Run tests**

Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/composite-engine.test.ts`
Then: `pnpm --filter @ghx-dev/core exec vitest run` (full suite to check for regressions)
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/core/execute/composite.ts packages/core/src/core/routing/engine.ts packages/core/test/unit/composite-engine.test.ts
git commit -m "feat: wire composite execution path with builder pattern into engine"
```

---

### Task 8: Enhance pr.review.submit with GraphQL Route + Inline Comments

**Files:**
- Create: `packages/core/src/gql/operations/pr-review-submit.graphql` (new GQL mutation)
- Modify: `packages/core/src/core/registry/cards/pr.review.submit.yaml`
- Modify: `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts`
- Modify: `packages/core/src/gql/client.ts` (add `submitPrReview` method)
- Create: `packages/core/test/unit/pr-review-submit-graphql.test.ts`

**Step 1: Write the failing test**

Create `packages/core/test/unit/pr-review-submit-graphql.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest"

describe("pr.review.submit via GraphQL", () => {
  it("submits review with inline comments using addPullRequestReview mutation", async () => {
    // Mock the GQL transport
    // Call the GraphQL adapter with pr.review.submit + comments array
    // Assert: mutation contains "addPullRequestReview"
    // Assert: variables include threads array
  })

  it("submits review without comments (body-only)", async () => {
    // Call with just event + body, no comments
    // Assert: threads variable is empty or absent
  })
})
```

**Step 2: Create the GraphQL operation**

Create `packages/core/src/gql/operations/pr-review-submit.graphql`:

```graphql
mutation PrReviewSubmit(
  $pullRequestId: ID!
  $event: PullRequestReviewEvent!
  $body: String
  $threads: [DraftPullRequestReviewThread!]
) {
  addPullRequestReview(
    input: {
      pullRequestId: $pullRequestId
      event: $event
      body: $body
      threads: $threads
    }
  ) {
    pullRequestReview {
      id
      state
      url
      body
    }
  }
}
```

Run codegen: `pnpm run ghx:gql:check` (or the codegen command)

**Step 3: Update the card**

Modify `packages/core/src/core/registry/cards/pr.review.submit.yaml`:

- Add `comments` to input_schema (optional array)
- Change routing preferred to `graphql`, add `cli` as fallback
- Add `graphql` metadata block

```yaml
routing:
  preferred: graphql
  fallbacks: [cli]
  suitability:
    - when: params
      predicate: "cli if comments == undefined"
      reason: "CLI route sufficient when no inline comments"
```

Add `comments` to `input_schema.properties`:

```yaml
comments:
  type: array
  items:
    type: object
    required: [path, body, line]
    properties:
      path: { type: string, minLength: 1 }
      body: { type: string, minLength: 1 }
      line: { type: integer, minimum: 1 }
      side: { type: string, enum: [LEFT, RIGHT] }
    additionalProperties: false
```

**Step 4: Implement GraphQL adapter handler**

Add `pr.review.submit` to `GraphqlCapabilityId` type and add the handler in `graphql-capability-adapter.ts`. The handler needs to:
1. Look up PR node ID via `pr.view` query (needs owner/name/prNumber → pullRequestId)
2. Map `comments` array to `threads` format expected by `DraftPullRequestReviewThread`
3. Call the new mutation

Also add `submitPrReview` method to `GithubClient` interface in `client.ts`.

**Step 5: Run tests and codegen check**

Run: `pnpm run ghx:gql:check`
Run: `pnpm --filter @ghx-dev/core exec vitest run test/unit/pr-review-submit-graphql.test.ts`
Run: `pnpm --filter @ghx-dev/core exec vitest run` (full suite)
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/gql/operations/pr-review-submit.graphql packages/core/src/core/registry/cards/pr.review.submit.yaml packages/core/src/core/execution/adapters/graphql-capability-adapter.ts packages/core/src/gql/client.ts packages/core/test/unit/pr-review-submit-graphql.test.ts
git commit -m "feat: enhance pr.review.submit with GraphQL route and inline comments"
```

---

### Task 9: Update SKILL.md with Composite Preference Instruction

**Files:**
- Modify: `packages/core/skills/using-ghx/SKILL.md`

**Step 1: No test needed** (documentation change)

**Step 2: Add composite instruction to SKILL.md**

Add after the "## Discovery" section:

```markdown
## Composite Capabilities

When a workflow involves multiple operations on the same resource,
prefer composite capabilities (suffixed with `.composite`) over
sequential atomic calls. Check `ghx capabilities list` for available
composites — their descriptions explain what they combine.
```

**Step 3: Commit**

```bash
git add packages/core/skills/using-ghx/SKILL.md
git commit -m "docs: add composite capability preference to SKILL.md"
```

---

### Task 10: Update Description in Design Doc + Skill Count

**Files:**
- Modify: `packages/core/skills/using-ghx/SKILL.md` (update capability count from 66 to new total)
- Modify: `docs/plans/2026-02-19-composite-capabilities-design.md` (mark as Implemented)

**Step 1: Update capability count**

The SKILL.md frontmatter says "66 capabilities". After adding 3 composite cards, update to the new count. Run `ghx capabilities list | wc -l` to get exact count.

**Step 2: Run full CI**

Run: `pnpm run ci --outputStyle=static`
Expected: All checks pass

**Step 3: Commit**

```bash
git add packages/core/skills/using-ghx/SKILL.md docs/plans/2026-02-19-composite-capabilities-design.md
git commit -m "docs: update capability count and mark design as implemented"
```

---

### Task 11: Run Full CI and Verify

**Step 1: Run CI**

```bash
pnpm run ci --outputStyle=static
```

Expected: All checks pass (build, format, lint, test, typecheck)

**Step 2: Run coverage**

```bash
pnpm run test:coverage
```

Expected: New files (batch.ts, composite.ts) have ≥90% coverage

**Step 3: GraphQL check (if .graphql files were added)**

```bash
pnpm run ghx:gql:check
```

Expected: PASS

---

## Summary of Files Changed

**New files:**
- `packages/core/src/gql/batch.ts` — GraphQL alias batching engine
- `packages/core/src/gql/builders.ts` — Operation builders (build + mapResponse) extracted from client methods
- `packages/core/src/core/execute/composite.ts` — Composite step expansion using builders
- `packages/core/src/gql/operations/pr-review-submit.graphql` — New GQL mutation
- `packages/core/src/core/registry/cards/pr.threads.composite.yaml`
- `packages/core/src/core/registry/cards/issue.triage.composite.yaml`
- `packages/core/src/core/registry/cards/issue.update.composite.yaml`
- `packages/core/test/unit/composite-types.test.ts`
- `packages/core/test/unit/gql-batch.test.ts`
- `packages/core/test/unit/gql-builders.test.ts`
- `packages/core/test/unit/composite-engine.test.ts`
- `packages/core/test/unit/pr-review-submit-graphql.test.ts`

**Modified files:**
- `packages/core/src/core/registry/types.ts` — Add CompositeConfig types
- `packages/core/src/core/registry/operation-card-schema.ts` — Add composite to schema
- `packages/core/src/core/registry/index.ts` — Update preferredOrder
- `packages/core/src/core/routing/engine.ts` — Add composite execution path
- `packages/core/src/gql/client.ts` — Refactor run* methods to use builders, export mutation constants, add submitPrReview
- `packages/core/src/core/execution/adapters/graphql-capability-adapter.ts` — Add pr.review.submit handler
- `packages/core/src/core/registry/cards/pr.review.submit.yaml` — Add GQL route + comments
- `packages/core/skills/using-ghx/SKILL.md` — Composite preference + count
- `packages/core/test/unit/capability-registry.test.ts` — Composite card tests
- `packages/core/test/unit/registry-validation.test.ts` — Composite schema tests
