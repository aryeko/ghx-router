# Workflow Scenario Roadmap

This document outlines the planned workflow scenarios for the benchmark suite. Workflow scenarios test multi-step, agent-driven processes that combine multiple capabilities to achieve a meaningful goal.

## Overview

Workflow scenarios differ from atomic scenarios by:
- **Natural language prompts** instead of structured task+input pairs
- **Checkpoint-based assertions** that verify intermediate and final states
- **Expected capability lists** that define which tools should be exercised
- **Longer execution timeouts** (typically 60-180 seconds)

## Completed Workflows

### 1. Fix PR Review Comments (`pr-fix-review-comments-wf-001`)
- **Description:** Read unresolved review comments on a PR and resolve each thread with an appropriate reply.
- **Expected Capabilities:** `pr.view`, `pr.threads.list`, `pr.comment.reply`, `pr.comment.resolve`
- **Complexity:** Medium
- **Fixture Requirements:** PR with existing review comments and threads
- **Status:** ✅ Implemented

---

## Planned Workflow Candidates

### 2. Triage a New Issue

**Workflow:** An issue has been created and needs triage. The agent should:
1. Read the issue details and description
2. Apply relevant labels based on content
3. Assign to appropriate team member(s)
4. Add to relevant project board

**Expected Capabilities:**
- `issue.view`
- `issue.labels.set`
- `issue.assignees.set`
- `project-v2.items.list`
- `project-v2.item.add-issue`

**Complexity:** Medium

**Fixture Requirements:**
- New issue with descriptive text
- Repository with pre-defined labels
- Project board configured for the repo

**Checkpoint Assertions:**
- Issue successfully retrieved
- Appropriate labels applied (verification: `issue.view` returns expected labels)
- Assignees set (verification: `issue.view` returns assignees)
- Issue added to project (verification: `project-v2.items.list` includes new issue)

---

### 3. Investigate Failing CI

**Workflow:** A PR has failed CI checks. The agent should:
1. Get PR details and status checks
2. Identify which checks failed
3. Retrieve logs from failed job(s)
4. Analyze logs to identify the root cause

**Expected Capabilities:**
- `pr.view`
- `pr.status-checks`
- `check-run.logs.get` (or equivalent workflow job logs)
- `check-run.annotations.list`

**Complexity:** High

**Fixture Requirements:**
- PR with failed status checks
- Workflow run with accessible job logs
- Logs containing identifiable error patterns

**Checkpoint Assertions:**
- PR status retrieved with failures
- Check runs listed and parsed
- Logs retrieved and analyzed
- Error pattern identified in final output

---

### 4. Review a PR

**Workflow:** A PR needs code review. The agent should:
1. View PR details
2. List changed files
3. Check status and review status
4. Submit an approval or request changes review

**Expected Capabilities:**
- `pr.view`
- `pr.diff.list-files`
- `pr.status-checks`
- `pr.reviews.submit`

**Complexity:** Medium-High

**Fixture Requirements:**
- PR with several changed files
- Status checks (some passing, some pending)
- Realistic code diff for review

**Checkpoint Assertions:**
- PR details retrieved
- Changed files listed
- Status checks verified
- Review submitted (verification: `pr.reviews.list` includes new review)

---

### 5. Merge a Ready PR

**Workflow:** A PR is ready to merge. The agent should:
1. Check PR mergeability
2. Verify all status checks pass
3. Ensure no pending reviews
4. Execute merge with appropriate settings

**Expected Capabilities:**
- `pr.view`
- `pr.mergeability.view`
- `pr.status-checks`
- `pr.reviews.list`
- `pr.merge.execute`

**Complexity:** Medium

**Fixture Requirements:**
- PR with passing status checks
- No blocking reviews or conflicts
- Merge permissions available

**Checkpoint Assertions:**
- Mergeability confirmed (not draft, no conflicts)
- All status checks passing
- No unresolved reviews
- PR merged (verification: `pr.view` shows merged status)

---

### 6. Manage Issue Relationships

**Workflow:** Issues need to be organized with parent/child relationships. The agent should:
1. Get parent issue details
2. Add a child issue as a blocker
3. Link related PRs to the issue
4. Update relationship metadata

**Expected Capabilities:**
- `issue.view`
- `issue.parent.set` or equivalent
- `issue.blocked-by.add`
- `issue.linked-prs.list`

**Complexity:** Medium

**Fixture Requirements:**
- Multiple issues for linking
- Issues that can serve as parent/child
- Related PRs in the repository

**Checkpoint Assertions:**
- Parent issue set correctly
- Blocker relationship established
- Related PRs linked (verification: `issue.linked-prs.list` includes new PR)
- Metadata updated

---

### 7. Dispatch and Monitor Workflow

**Workflow:** Dispatch a workflow run and monitor its progress. The agent should:
1. Get workflow details
2. Dispatch a run with specific inputs
3. Poll the run status
4. Retrieve and analyze job results

**Expected Capabilities:**
- `workflow.view`
- `workflow.dispatch`
- `workflow.run.view`
- `workflow.job.logs.view`

**Complexity:** High

**Fixture Requirements:**
- Repository with dispatch-enabled workflow
- Workflow that accepts dispatch inputs
- Permissions to dispatch runs

**Checkpoint Assertions:**
- Workflow exists and is accessible
- Run successfully dispatched
- Run status polled and progressed
- Jobs retrieved and analyzed
- Final status captured

---

### 8. Project Board Management

**Workflow:** Manage a project board by:
1. Get project details
2. List project fields
3. Add multiple items to the board
4. Update field values (e.g., status, priority)

**Expected Capabilities:**
- `project-v2.org-get` or `project-v2.user-get`
- `project-v2.fields.list`
- `project-v2.items.list`
- `project-v2.item.add-issue`
- `project-v2.item.field-update`

**Complexity:** Medium-High

**Fixture Requirements:**
- Project board with custom fields
- Multiple issues to add
- Field values to assign

**Checkpoint Assertions:**
- Project retrieved
- Fields enumerated
- Items added (verification: `project-v2.items.list` count increases)
- Field values updated (verification: `project-v2.items.list` shows new values)

---

## Workflow Scenario Complexity Levels

| Complexity | Description | Tool Calls | Estimated Checkpoints |
|-----------|-----------|-----------|----------------------|
| **Low** | Single domain, 2-3 steps | 3-6 | 1-2 |
| **Medium** | Single domain, 4-5 steps | 6-10 | 2-3 |
| **Medium-High** | Cross-domain, 4-5 steps | 8-12 | 3-4 |
| **High** | Complex orchestration, polling, 5+ steps | 12+ | 4+ |

## Implementation Priority

1. ✅ **Fix PR Review Comments** (Phase 2b)
2. **Triage a New Issue** (Phase 3 candidate)
3. **Review a PR** (Phase 3 candidate)
4. **Merge a Ready PR** (Phase 3 candidate)
5. **Investigate Failing CI** (Phase 4 candidate)
6. **Dispatch and Monitor Workflow** (Phase 4 candidate)
7. **Manage Issue Relationships** (Phase 5 candidate)
8. **Project Board Management** (Phase 5 candidate)

## Testing Workflow Scenarios

Workflow scenarios are tested using checkpoint assertions that verify:

1. **Intermediate state verification** — Each checkpoint runs a verification task and checks its result
2. **Condition matching** — Conditions like `empty`, `count_eq`, or `field_equals` validate checkpoint results
3. **Progressive validation** — Checkpoints are ordered and executed sequentially

Example checkpoint structure:

```json
{
  "name": "all_threads_resolved",
  "verification_task": "pr.threads.list",
  "verification_input": { "state": "unresolved" },
  "condition": "empty",
  "expected_value": null
}
```

This verifies that after the workflow completes, calling `pr.comments.list` with `state: "unresolved"` returns an empty result.
