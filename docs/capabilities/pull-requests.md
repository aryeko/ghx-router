# Pull Request Capabilities

Pull request capabilities enable full workflow automation — view, list, merge, and update
PRs. Manage reviews, comments, assignees, check runs, and mergeability signals.

## Capabilities

### CRUD and Retrieval

#### `pr.view`

**Description:** Fetch one pull request by number.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global PR ID |
| number | integer | Repository-scoped PR number |
| title | string | PR title |
| state | string | Current state (OPEN, CLOSED, MERGED) |
| url | string | GitHub web URL |

**Routes:** cli (preferred), graphql (fallback)

**Example:**

```bash
npx ghx run pr.view --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```

---

#### `pr.list`

**Description:** List repository pull requests.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| state | string | no | Filter by state (e.g., "open", "closed") |
| first | integer | no | Number of items per page (1+) |
| after | string or null | no | Pagination cursor |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | PR list (id, number, title, state, url) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred), graphql (fallback)

**Example:**

```bash
npx ghx run pr.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "state": "open",
  "first": 10
}'
```

---

### Merge and Branch

#### `pr.merge.execute`

**Description:** Execute a pull request merge.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| method | string | no | Merge method: "merge", "squash", "rebase" |
| deleteBranch | boolean | no | Delete branch after merge |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| method | string | Merge method used |
| queued | boolean | true if merge queued |
| deleteBranch | boolean | Branch deletion flag |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.merge.execute --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "method": "squash",
  "deleteBranch": true
}'
```

---

#### `pr.branch.update`

**Description:** Update pull request branch with latest base branch changes.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| updated | boolean | true if updated |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.branch.update --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```

---

#### `pr.ready_for_review.set`

**Description:** Mark pull request as ready for review or draft.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| ready | boolean | yes | true for ready, false for draft |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| isDraft | boolean | true if draft, false if ready |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.ready_for_review.set --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "ready": true
}'
```

---

### Assignees and Reviewers

#### `pr.assignees.update`

**Description:** Update pull request assignees.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| add | array | conditional | Usernames to add |
| remove | array | conditional | Usernames to remove |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| add | array | Added usernames |
| remove | array | Removed usernames |
| updated | boolean | true if changed |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.assignees.update --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "add": ["alice", "bob"]
}'
```

---

#### `pr.reviewers.request`

**Description:** Request pull request reviewers.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| reviewers | array | yes | Usernames to request (min 1) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| reviewers | array | Requested usernames |
| updated | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.reviewers.request --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "reviewers": ["alice", "bob"]
}'
```

---

### Comments and Review Threads

#### `pr.comments.list`

**Description:** List pull request review threads with unresolved filtering.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| first | integer | no | Number of items per page (1+) |
| after | string or null | no | Pagination cursor |
| unresolvedOnly | boolean | no | Filter unresolved threads |
| includeOutdated | boolean | no | Include outdated threads |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Review threads with nested comments |
| pageInfo | object | Pagination (hasNextPage, endCursor) |
| filterApplied | object | Applied filters (unresolvedOnly, includeOutdated) |
| scan | object | Scan metrics (pagesScanned, sourceItemsScanned) |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.comments.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "first": 20,
  "unresolvedOnly": true
}'
```

---

#### `pr.comment.reply`

**Description:** Reply to a pull request review thread.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| threadId | string | yes | Review thread ID |
| body | string | yes | Reply body (markdown, min 1 char) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Thread ID |
| isResolved | boolean | Current resolution state |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.comment.reply --input '{
  "threadId": "PRRT_kwDODhlyV4567890",
  "body": "Good point. I will update the implementation."
}'
```

---

#### `pr.comment.resolve`

**Description:** Resolve a pull request review thread.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| threadId | string | yes | Review thread ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Thread ID |
| isResolved | boolean | true |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.comment.resolve --input '{
  "threadId": "PRRT_kwDODhlyV4567890"
}'
```

---

#### `pr.comment.unresolve`

**Description:** Unresolve a pull request review thread.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| threadId | string | yes | Review thread ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Thread ID |
| isResolved | boolean | false |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.comment.unresolve --input '{
  "threadId": "PRRT_kwDODhlyV4567890"
}'
```

---

### Reviews

#### `pr.reviews.list`

**Description:** List pull request reviews.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| first | integer | no | Number of items per page (1+) |
| after | string or null | no | Pagination cursor |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Reviews (id, authorLogin, body, state, submittedAt, url) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.reviews.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "first": 10
}'
```

---

#### `pr.review.submit_approve`

**Description:** Submit an approving pull request review.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| body | string | no | Review comment body (markdown, min 1 char) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| event | string | APPROVE |
| submitted | boolean | true |
| body | string or null | Review body |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.review.submit_approve --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "body": "Looks good! Ready to merge."
}'
```

---

#### `pr.review.submit_comment`

**Description:** Submit a comment-only pull request review.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| body | string | yes | Review comment body (markdown, min 1 char) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| event | string | COMMENT |
| submitted | boolean | true |
| body | string | Review body |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.review.submit_comment --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "body": "Can you add tests for this feature?"
}'
```

---

#### `pr.review.submit_request_changes`

**Description:** Submit a pull request review requesting changes.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| body | string | yes | Review comment body (markdown, min 1 char) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| event | string | REQUEST_CHANGES |
| submitted | boolean | true |
| body | string | Review body |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.review.submit_request_changes --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "body": "Need to refactor error handling before merge."
}'
```

---

### Checks and Status

#### `pr.checks.get_failed`

**Description:** List failed pull request checks.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Failed checks (name, state, workflow, link) |
| summary | object | Summary (total, failed, pending, passed) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.checks.get_failed --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```

---

#### `pr.checks.rerun_all`

**Description:** Rerun all PR workflow checks for a selected run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| runId | integer | Workflow run ID |
| mode | string | all |
| queued | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.checks.rerun_all --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "runId": 5678
}'
```

---

#### `pr.checks.rerun_failed`

**Description:** Rerun failed PR workflow checks for a selected run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| runId | integer | Workflow run ID |
| mode | string | failed |
| queued | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.checks.rerun_failed --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "runId": 5678
}'
```

---

#### `pr.status.checks`

**Description:** List pull request check statuses with summary counts.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | All checks (name, state, workflow, link) |
| summary | object | Summary (total, failed, pending, passed) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.status.checks --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```

---

### Diff and Mergeability

#### `pr.diff.list_files`

**Description:** List changed files in a pull request diff.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| first | integer | no | Number of items per page (1+) |
| after | string or null | no | Pagination cursor |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Files (path, additions, deletions) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.diff.list_files --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "first": 50
}'
```

---

#### `pr.mergeability.view`

**Description:** View pull request mergeability and readiness signals.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| mergeable | string or null | Mergeable status |
| mergeStateStatus | string or null | Merge state (BEHIND, BLOCKED, CLEAN, DIRTY) |
| reviewDecision | string or null | Review decision (APPROVED, CHANGES_REQUESTED) |
| isDraft | boolean | true if draft |
| state | string | PR state |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.mergeability.view --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```
