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
| body | string | PR body text |
| labels | array | Label names (array of strings) |

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

#### `pr.merge`

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
npx ghx run pr.merge --input '{
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

#### `pr.update`

**Description:** Update pull request metadata (title, body, draft status).

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| title | string | no | New PR title |
| body | string | no | New PR body (markdown) |
| draft | boolean | no | true for draft, false for ready |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| title | string | Updated title |
| body | string | Updated body |
| isDraft | boolean | Current draft state |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.update --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "draft": false
}'
```

---

### Assignees and Reviewers

#### `pr.assignees.add`

**Description:** Add assignees to a pull request.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| assignees | array | yes | Usernames to add (min 1) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| added | array | Added usernames |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.assignees.add --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "assignees": ["alice", "bob"]
}'
```

---

#### `pr.assignees.remove`

**Description:** Remove assignees from a pull request.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| assignees | array | yes | Usernames to remove (min 1) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| removed | array | Removed usernames |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.assignees.remove --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "assignees": ["alice"]
}'
```

---

#### `pr.reviews.request`

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
npx ghx run pr.reviews.request --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "reviewers": ["alice", "bob"]
}'
```

---

### Comments and Review Threads

#### `pr.threads.list`

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
npx ghx run pr.threads.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "first": 20,
  "unresolvedOnly": true
}'
```

---

#### `pr.threads.reply`

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
npx ghx run pr.threads.reply --input '{
  "threadId": "PRRT_kwDODhlyV4567890",
  "body": "Good point. I will update the implementation."
}'
```

---

#### `pr.threads.resolve`

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
npx ghx run pr.threads.resolve --input '{
  "threadId": "PRRT_kwDODhlyV4567890"
}'
```

---

#### `pr.threads.unresolve`

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
npx ghx run pr.threads.unresolve --input '{
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

#### `pr.reviews.submit`

**Description:** Submit a pull request review (approve, request changes, or comment).

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |
| event | string | yes | Review event (APPROVE, COMMENT, REQUEST_CHANGES) |
| body | string | no | Review comment body (markdown, min 1 char) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| prNumber | integer | PR number |
| event | string | Review event submitted |
| submitted | boolean | true |
| body | string or null | Review body |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run pr.reviews.submit --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "event": "APPROVE",
  "body": "Looks good! Ready to merge."
}'
```

---

### Checks and Status

#### `pr.checks.list`

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
npx ghx run pr.checks.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```

---

#### `pr.checks.rerun.all`

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
| runId | integer | Workflow run ID |
| queued | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.checks.rerun.all --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "runId": 5678
}'
```

---

#### `pr.checks.rerun.failed`

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
| runId | integer | Workflow run ID |
| queued | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.checks.rerun.failed --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "runId": 5678
}'
```

---

### Diff and Mergeability

#### `pr.diff.files`

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
npx ghx run pr.diff.files --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123,
  "first": 50
}'
```

---

#### `pr.diff.view`

**Description:** View the unified diff for a pull request.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| prNumber | integer | yes | PR number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| diff | string | Unified diff text |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run pr.diff.view --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```

---

#### `pr.merge.status`

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

**Routes:** graphql (preferred), cli (fallback)

**Example:**

```bash
npx ghx run pr.merge.status --input '{
  "owner": "octocat",
  "name": "hello-world",
  "prNumber": 123
}'
```
