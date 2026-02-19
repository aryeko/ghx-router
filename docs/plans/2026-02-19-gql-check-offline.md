# GraphQL Drift Check Offline Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make GraphQL codegen drift checks deterministic and offline by default, while keeping schema refresh as an explicit on-demand command.

**Architecture:** Split GraphQL codegen into two configs: one local/offline config used by `gql:codegen` and `gql:check`, and one remote/authenticated config used only by `gql:schema:update`. Keep existing generated import post-processing and add focused tests for both configs and token behavior.

**Tech Stack:** TypeScript, GraphQL Code Generator, Vitest, pnpm, Nx, GitHub Actions

---

### Task 1: Add failing tests for config split and schema-update token behavior

**Files:**
- Modify: `packages/core/test/unit/codegen-config.test.ts`
- Create: `packages/core/test/unit/codegen-schema-config.test.ts`
- Modify: `packages/core/test/unit/get-github-token.test.ts`

**Step 1: Write failing assertions for local codegen config**

Add assertions that default codegen config:
- uses `schema: "src/gql/schema.graphql"`
- does not require `GITHUB_TOKEN` at module import time
- keeps current `documents` and `near-operation-file` settings

**Step 2: Write failing assertions for remote schema-update config**

Create `codegen-schema-config.test.ts` that imports `codegen.schema.ts` and asserts:
- schema source targets `https://api.github.com/graphql`
- auth header is present and uses token from env or token resolver path
- generates target is only `src/gql/schema.graphql` with `schema-ast`

**Step 3: Write failing token-resolution tests**

Update `get-github-token.test.ts` to cover user-facing failure text for schema update when neither `GITHUB_TOKEN` nor `GH_TOKEN` is set.

**Step 4: Run targeted tests and confirm failures**

Run: `pnpm --filter @ghx-dev/core run test -- --project unit -t "codegen config|schema config|get github token"`
Expected: FAIL due to missing `codegen.schema.ts` and current token-required `codegen.ts` behavior.

**Step 5: Commit tests only**

```bash
git add packages/core/test/unit/codegen-config.test.ts packages/core/test/unit/codegen-schema-config.test.ts packages/core/test/unit/get-github-token.test.ts
git commit -m "test(core): add coverage for offline codegen split"
```

### Task 2: Implement split codegen configs and on-demand schema update

**Files:**
- Modify: `packages/core/codegen.ts`
- Create: `packages/core/codegen.schema.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/scripts/run-gql-codegen.ts`
- Create: `packages/core/src/gql/schema.graphql`

**Step 1: Switch default codegen to local schema**

Update `codegen.ts` to:
- remove direct token/env requirement
- set `schema` to `"src/gql/schema.graphql"`
- keep operation generation config unchanged

**Step 2: Create remote schema update config**

Add `codegen.schema.ts` to:
- read token via env (`GITHUB_TOKEN` then `GH_TOKEN`) with explicit actionable error if missing
- point schema to GitHub GraphQL endpoint with Authorization header
- generate only `src/gql/schema.graphql` via `schema-ast` plugin (`includeDirectives: true`)

**Step 3: Wire scripts and dependencies**

In `packages/core/package.json`:
- add `gql:schema:update` script (`graphql-codegen --config codegen.schema.ts`)
- add `@graphql-codegen/schema-ast` devDependency

**Step 4: Remove token plumbing from wrapper script**

In `run-gql-codegen.ts`:
- remove `resolveGithubToken` usage
- remove env token injection for spawned process
- keep `fixGeneratedImportExtensions`

**Step 5: Generate and commit schema snapshot**

Run: `pnpm --filter @ghx-dev/core run gql:schema:update`
Expected: writes/updates `packages/core/src/gql/schema.graphql`

**Step 6: Run tests and verify green**

Run: `pnpm --filter @ghx-dev/core run test -- --project unit -t "codegen config|schema config|get github token"`
Expected: PASS

**Step 7: Commit implementation**

```bash
git add packages/core/codegen.ts packages/core/codegen.schema.ts packages/core/package.json packages/core/scripts/run-gql-codegen.ts packages/core/src/gql/schema.graphql packages/core/test/unit/codegen-config.test.ts packages/core/test/unit/codegen-schema-config.test.ts packages/core/test/unit/get-github-token.test.ts
git commit -m "feat(core): make graphql codegen offline by default"
```

### Task 3: Update CI wiring to keep drift checks enforced on PR and main

**Files:**
- Modify: `packages/core/package.json`
- Modify: `.github/workflows/ci-pr.yml`
- Modify: `.github/workflows/ci-main.yml`

**Step 1: Decouple gql check from core ci:extra target**

Remove `gql:check` from `packages/core/package.json` `nx.targets.ci:extra.dependsOn`.

**Step 2: Add explicit PR gql-check job**

Add a dedicated job in `ci-pr.yml` that installs deps and runs:
- `pnpm --filter @ghx-dev/core run gql:check`

**Step 3: Add explicit main gql-check job**

Add a dedicated job in `ci-main.yml` (or equivalent step) that also runs:
- `pnpm --filter @ghx-dev/core run gql:check`

**Step 4: Validate workflow syntax and target behavior**

Run:
- `pnpm --filter @ghx-dev/core run gql:check`
- `pnpm run ci:affected`

Expected: both pass locally with no auth/network requirement for drift checks.

**Step 5: Commit CI updates**

```bash
git add packages/core/package.json .github/workflows/ci-pr.yml .github/workflows/ci-main.yml
git commit -m "ci: run graphql drift check as dedicated workflow job"
```

### Task 4: Update contributor documentation for new GraphQL workflow

**Files:**
- Modify: `docs/contributing/ci-workflows.md`
- Modify: `docs/contributing/development-setup.md`
- Modify: `CONTRIBUTING.md`
- Modify (if needed): `CLAUDE.md`

**Step 1: Document command split**

Update docs to clearly describe:
- `gql:check` validates drift offline
- `gql:schema:update` refreshes schema from GitHub on demand

**Step 2: Document CI behavior**

Update CI docs to mention dedicated gql-check jobs for PR/main and removal from implicit `ci` dependency chain.

**Step 3: Validate docs references**

Run: `rg -n "gql:check|gql:schema:update|ci:affected|ci" docs CONTRIBUTING.md CLAUDE.md`
Expected: consistent terminology and no stale statements.

**Step 4: Commit docs updates**

```bash
git add docs/contributing/ci-workflows.md docs/contributing/development-setup.md CONTRIBUTING.md CLAUDE.md
git commit -m "docs: describe offline graphql drift check and schema refresh flow"
```

### Task 5: Full verification before handoff

**Files:**
- No code changes expected

**Step 1: Run GraphQL-specific verification**

Run:
- `pnpm --filter @ghx-dev/core run gql:codegen`
- `pnpm --filter @ghx-dev/core run gql:check`

Expected: both pass without setting `GITHUB_TOKEN`.

**Step 2: Negative-path verification**

Manually edit one generated file and run `gql:check`; confirm failure. Revert manual edit.
Manually edit one `.graphql` file without regenerating and run `gql:check`; confirm failure. Revert manual edit.

**Step 3: Run full project CI command**

Run: `pnpm run ci --outputStyle=static`
Expected: PASS.

**Step 4: Final status capture**

Record exact commands run and pass/fail outcomes in PR description or implementation summary.
