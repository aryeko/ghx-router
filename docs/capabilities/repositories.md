# Repository Capabilities

Repository capabilities provide read-only access to repository metadata, labels, and
issue type configuration.

## Capabilities

### Metadata

#### `repo.view`

**Description:** Fetch repository metadata.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner (user or org) |
| name | string | yes | Repository name |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Global repository ID |
| name | string | Repository name |
| nameWithOwner | string | Full name (owner/name) |
| isPrivate | boolean | true if private |
| stargazerCount | integer | Number of stars (0+) |
| forkCount | integer | Number of forks (0+) |
| url | string | GitHub web URL |
| defaultBranch | string or null | Default branch name |

**Routes:** cli (preferred), graphql (fallback)

**Example:**

```bash
npx ghx run repo.view --input '{
  "owner": "octocat",
  "name": "hello-world"
}'
```

---

### Labels

#### `repo.labels.list`

**Description:** List repository labels.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| first | integer | no | Number of items per page (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Labels (id, name, description, color, isDefault) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run repo.labels.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "first": 50
}'
```

---

### Issue Types

#### `repo.issue_types.list`

**Description:** List repository issue types (custom issue forms).

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| first | integer | no | Number of items per page (1+) |
| after | string | no | Pagination cursor |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Issue types (id, name, color, isEnabled) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run repo.issue_types.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "first": 20
}'
```
