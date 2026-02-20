# Issue Capabilities

Issue capabilities enable full lifecycle management — create, view, update, close, reopen,
and delete issues. Add comments, manage labels and assignees, set milestones, and track
parent/child/blocking relationships.

## Capabilities

### CRUD Operations

#### `issue.create`

**Description:** Create a new issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner (user or org) |
| name | string | yes | Repository name |
| title | string | yes | Issue title |
| body | string | no | Markdown issue body |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| number | integer | Repository-scoped issue number |
| title | string | Issue title |
| state | string | Current state (OPEN or CLOSED) |
| url | string | GitHub web URL |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.create --input '{
  "owner": "octocat",
  "name": "hello-world",
  "title": "Add support for webhooks",
  "body": "Implement webhook event delivery system"
}'
```

---

#### `issue.view`

**Description:** Fetch one issue by number.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| issueNumber | integer | yes | Issue number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| number | integer | Repository-scoped issue number |
| title | string | Issue title |
| state | string | Current state |
| url | string | GitHub web URL |
| body | string | Issue body text |
| labels | array | Label names (array of strings) |

**Routes:** cli (preferred), graphql (fallback)

**Example:**

```bash
npx ghx run issue.view --input '{
  "owner": "octocat",
  "name": "hello-world",
  "issueNumber": 42
}'
```

---

#### `issue.list`

**Description:** List repository issues.

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
| items | array | Issue list (id, number, title, state, url) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred), graphql (fallback)

**Example:**

```bash
npx ghx run issue.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "state": "open",
  "first": 10
}'
```

---

#### `issue.update`

**Description:** Update issue title and/or body.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |
| title | string | no | New title |
| body | string | no | New body (markdown) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| number | integer | Issue number |
| title | string | Updated title |
| state | string | Current state |
| url | string | GitHub web URL |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.update --input '{
  "issueId": "I_kwDODhlyV4567890",
  "title": "Update: Add webhook support"
}'
```

---

#### `issue.close`

**Description:** Close an issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| number | integer | Issue number |
| state | string | Should be CLOSED |
| closed | boolean | true |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.close --input '{
  "issueId": "I_kwDODhlyV4567890"
}'
```

---

#### `issue.reopen`

**Description:** Reopen a closed issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| number | integer | Issue number |
| state | string | Should be OPEN |
| reopened | boolean | true |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.reopen --input '{
  "issueId": "I_kwDODhlyV4567890"
}'
```

---

#### `issue.delete`

**Description:** Delete an issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| number | integer | Issue number |
| deleted | boolean | true |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.delete --input '{
  "issueId": "I_kwDODhlyV4567890"
}'
```

---

### Comments

#### `issue.comments.create`

**Description:** Create an issue comment.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |
| body | string | yes | Comment body (markdown, min 1 char) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Comment ID |
| body | string | Comment text |
| url | string | Comment URL |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.comments.create --input '{
  "issueId": "I_kwDODhlyV4567890",
  "body": "I agree with this approach. Let'\''s proceed."
}'
```

---

#### `issue.comments.list`

**Description:** List comments for one issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| issueNumber | integer | yes | Issue number (1+) |
| first | integer | yes | Number of items per page (1+) |
| after | string or null | no | Pagination cursor |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Comments (id, body, authorLogin, url, createdAt) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** graphql (preferred), cli (fallback)

**Example:**

```bash
npx ghx run issue.comments.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "issueNumber": 42,
  "first": 20
}'
```

---

### Labels

#### `issue.labels.set`

**Description:** Replace issue labels.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |
| labels | array | yes | Label names (array of strings) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| labels | array | Applied label names |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.labels.set --input '{
  "issueId": "I_kwDODhlyV4567890",
  "labels": ["bug", "high-priority", "in-progress"]
}'
```

---

#### `issue.labels.add`

**Description:** Add labels to an issue without removing existing labels.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |
| labels | array | yes | Label names to add (array of strings) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| labels | array | All label names after addition |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.labels.add --input '{
  "issueId": "I_kwDODhlyV4567890",
  "labels": ["bug", "needs-triage"]
}'
```

---

### Assignees

#### `issue.assignees.set`

**Description:** Replace issue assignees.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |
| assignees | array | yes | GitHub usernames (array of strings) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| assignees | array | Assigned usernames |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.assignees.set --input '{
  "issueId": "I_kwDODhlyV4567890",
  "assignees": ["octocat", "hubot"]
}'
```

---

### Milestone

#### `issue.milestone.set`

**Description:** Set issue milestone number or clear with null.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Global issue ID |
| milestoneNumber | integer or null | yes | Milestone number (1+) or null to clear |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global issue ID |
| milestoneNumber | integer or null | Assigned milestone number |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.milestone.set --input '{
  "issueId": "I_kwDODhlyV4567890",
  "milestoneNumber": 3
}'
```

---

### Relations

#### `issue.relations.get`

**Description:** Get issue parent/children/blocking relations.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| issueNumber | integer | yes | Issue number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| issue | object | Issue (id, number) |
| parent | object or null | Parent issue (id, number) if exists |
| children | array | Child issues (id, number) |
| blockedBy | array | Blocking issues (id, number) |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.relations.get --input '{
  "owner": "octocat",
  "name": "hello-world",
  "issueNumber": 42
}'
```

---

#### `issue.parent.set`

**Description:** Set an issue parent relation.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Child issue ID |
| parentIssueId | string | yes | Parent issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| issueId | string | Child issue ID |
| parentIssueId | string | Parent issue ID |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.parent.set --input '{
  "issueId": "I_kwDODhlyV4567890",
  "parentIssueId": "I_kwDODhlyV4567800"
}'
```

---

#### `issue.parent.remove`

**Description:** Remove an issue parent relation.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Child issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| issueId | string | Child issue ID |
| parentRemoved | boolean | true |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.parent.remove --input '{
  "issueId": "I_kwDODhlyV4567890"
}'
```

---

#### `issue.blocked_by.add`

**Description:** Add a blocked-by relation for an issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Blocked issue ID |
| blockedByIssueId | string | yes | Blocking issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| issueId | string | Blocked issue ID |
| blockedByIssueId | string | Blocking issue ID |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.blocked_by.add --input '{
  "issueId": "I_kwDODhlyV4567890",
  "blockedByIssueId": "I_kwDODhlyV4567800"
}'
```

---

#### `issue.blocked_by.remove`

**Description:** Remove a blocked-by relation for an issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | yes | Blocked issue ID |
| blockedByIssueId | string | yes | Blocking issue ID |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| issueId | string | Blocked issue ID |
| blockedByIssueId | string | Blocking issue ID |
| removed | boolean | true |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.blocked_by.remove --input '{
  "issueId": "I_kwDODhlyV4567890",
  "blockedByIssueId": "I_kwDODhlyV4567800"
}'
```

---

#### `issue.linked_prs.list`

**Description:** List pull requests linked to an issue.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| issueNumber | integer | yes | Issue number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Linked PRs (id, number, title, state, url) |

**Routes:** graphql (preferred)

**Example:**

```bash
npx ghx run issue.linked_prs.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "issueNumber": 42
}'
```
