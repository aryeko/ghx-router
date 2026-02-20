# Benchmark Scenario Composite Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update three workflow benchmark scenarios to reflect today's composite capability merges and expanded CI diagnosis scope.

**Architecture:** Direct JSON edits to scenario files in `packages/benchmark/scenarios/workflows/`. No code changes required — `expected_capabilities` arrays are schema-validated strings with no registry lookup at load time. `pr-review-comment-wf-001` needs no changes.

**Tech Stack:** JSON, Vitest (benchmark test suite), `pnpm --filter @ghx-dev/benchmark`

---

### Task 1: Update `pr-fix-review-comments-wf-001`

Replace atomic thread capabilities with `pr.threads.composite`.

**Files:**
- Modify: `packages/benchmark/scenarios/workflows/pr-fix-review-comments-wf-001.json`

**Step 1: Edit `expected_capabilities`**

Open the file. Change:
```json
"expected_capabilities": ["pr.view", "pr.thread.list", "pr.thread.reply", "pr.thread.resolve"]
```
To:
```json
"expected_capabilities": ["pr.view", "pr.thread.list", "pr.threads.composite"]
```

Everything else in the file stays exactly the same (prompt, fixture, assertions, tags).

**Step 2: Verify the file looks correct**

Run:
```bash
cat packages/benchmark/scenarios/workflows/pr-fix-review-comments-wf-001.json
```
Expected: JSON with `"expected_capabilities": ["pr.view", "pr.thread.list", "pr.threads.composite"]`.

**Step 3: Run scenario validation**

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
```
Expected: exits 0 with no errors.

**Step 4: Commit**

```bash
git add packages/benchmark/scenarios/workflows/pr-fix-review-comments-wf-001.json
git commit -m "feat(benchmark): use pr.threads.composite in pr-fix-review-comments-wf-001"
```

---

### Task 2: Update `issue-triage-comment-wf-001`

Replace atomic label + comment capabilities with `issue.triage.composite`.

**Files:**
- Modify: `packages/benchmark/scenarios/workflows/issue-triage-comment-wf-001.json`

**Step 1: Edit `expected_capabilities`**

Open the file. Change:
```json
"expected_capabilities": ["issue.view", "issue.labels.update", "issue.comments.create"]
```
To:
```json
"expected_capabilities": ["issue.view", "issue.triage.composite"]
```

Everything else stays the same. Note: `issue.triage.composite` requires a node ID (`issueId`), not the issue number. The agent must call `issue.view` first to obtain it — `issue.view` is already in `expected_capabilities`, so the agent flow is correct.

**Step 2: Verify the file looks correct**

```bash
cat packages/benchmark/scenarios/workflows/issue-triage-comment-wf-001.json
```
Expected: `"expected_capabilities": ["issue.view", "issue.triage.composite"]`.

**Step 3: Run scenario validation**

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
```
Expected: exits 0.

**Step 4: Commit**

```bash
git add packages/benchmark/scenarios/workflows/issue-triage-comment-wf-001.json
git commit -m "feat(benchmark): use issue.triage.composite in issue-triage-comment-wf-001"
```

---

### Task 3: Update `ci-diagnose-run-wf-001`

Expand from "view run" to "view run + fetch failed job logs."

**Files:**
- Modify: `packages/benchmark/scenarios/workflows/ci-diagnose-run-wf-001.json`

**Step 1: Edit `prompt` and `expected_capabilities`**

Open the file. Change:

```json
"prompt": "Workflow run {{runId}} in {{owner}}/{{name}} has failed. Get the run details to confirm its status and conclusion, and identify which job failed."
```
To:
```json
"prompt": "Workflow run {{runId}} in {{owner}}/{{name}} has failed. Get the run details to confirm its status and conclusion, identify which job failed, and fetch that job's logs to surface the top error lines."
```

And change:
```json
"expected_capabilities": ["workflow.run.view"]
```
To:
```json
"expected_capabilities": ["workflow.run.view", "workflow.job.logs.get"]
```

Everything else stays the same (fixture, assertions, tags).

**Step 2: Verify the file looks correct**

```bash
cat packages/benchmark/scenarios/workflows/ci-diagnose-run-wf-001.json
```
Expected: updated prompt and `"expected_capabilities": ["workflow.run.view", "workflow.job.logs.get"]`.

**Step 3: Run scenario validation**

```bash
pnpm --filter @ghx-dev/benchmark run check:scenarios
```
Expected: exits 0.

**Step 4: Commit**

```bash
git add packages/benchmark/scenarios/workflows/ci-diagnose-run-wf-001.json
git commit -m "feat(benchmark): expand ci-diagnose-run-wf-001 to require job log diagnosis"
```

---

### Task 4: Run full benchmark test suite

Confirm all benchmark unit tests still pass with the updated scenario files.

**Step 1: Run benchmark tests**

```bash
pnpm --filter @ghx-dev/benchmark exec vitest run
```
Expected: all tests pass. Tests to watch:
- `test/unit/scenario-schema.test.ts` — validates scenario JSON structure
- `test/unit/scenario-sets-manifest.test.ts` — checks scenario-sets.json references
- `test/unit/check-scenarios.test.ts` — validates scenario set integrity

**Step 2: If any test fails**

Check which test failed. Likely cause: a test fixture hard-codes an `expected_capabilities` value from one of the changed scenarios. Fix by updating the test fixture to match the new capability name.

**Step 3: Run full CI**

```bash
pnpm run ci --outputStyle=static
```
Expected: exits 0 across all packages.

**Step 4: Commit (only if Step 2 required test fixes)**

```bash
git add packages/benchmark/test/
git commit -m "test(benchmark): update fixtures for composite capability rename"
```
