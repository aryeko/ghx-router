# Release Capabilities

Release capabilities manage the release lifecycle — create draft releases, publish drafts,
update metadata, list releases, and retrieve details by tag.

## Capabilities

### Retrieval

#### `release.get`

**Description:** Get release details by tag name.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| tagName | string | yes | Release tag name |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Release ID (0+) |
| tagName | string or null | Tag name |
| name | string or null | Release name/title |
| isDraft | boolean | true if draft |
| isPrerelease | boolean | true if prerelease |
| url | string or null | GitHub release URL |
| targetCommitish | string or null | Target commit/ref |
| createdAt | string or null | ISO timestamp |
| publishedAt | string or null | ISO timestamp |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run release.get --input '{
  "owner": "octocat",
  "name": "hello-world",
  "tagName": "v1.0.0"
}'
```

---

#### `release.list`

**Description:** List releases for a repository.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| first | integer | no | Number of items per page (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Release list (id, tagName, name, isDraft, isPrerelease, url, etc.) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run release.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "first": 20
}'
```

---

### Draft Management

#### `release.create_draft`

**Description:** Create a draft release. Draft releases are not visible to end users.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| tagName | string | yes | Release tag name |
| title | string | no | Release title |
| notes | string | no | Release notes (markdown) |
| targetCommitish | string | no | Target commit, branch, or tag |
| prerelease | boolean | no | Mark as prerelease |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Release ID |
| tagName | string or null | Tag name |
| name | string or null | Release title |
| isDraft | boolean | true |
| isPrerelease | boolean | Prerelease flag |
| url | string or null | Release URL |
| targetCommitish | string or null | Target ref |
| createdAt | string or null | ISO timestamp |
| publishedAt | string or null | Null for drafts |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run release.create_draft --input '{
  "owner": "octocat",
  "name": "hello-world",
  "tagName": "v2.0.0",
  "title": "Version 2.0.0 - Major Release",
  "notes": "## Features\n\n- New webhook system\n- Performance improvements",
  "prerelease": false
}'
```

---

#### `release.publish_draft`

**Description:** Publish an existing draft release.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| releaseId | integer | yes | Release ID (1+) |
| title | string | no | Updated release title |
| notes | string | no | Updated release notes |
| prerelease | boolean | no | Prerelease flag |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Release ID |
| tagName | string or null | Tag name |
| name | string or null | Release title |
| isDraft | boolean | false after publish |
| isPrerelease | boolean | Prerelease flag |
| url | string or null | Release URL |
| targetCommitish | string or null | Target ref |
| createdAt | string or null | ISO timestamp |
| publishedAt | string or null | ISO timestamp (now populated) |
| wasDraft | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run release.publish_draft --input '{
  "owner": "octocat",
  "name": "hello-world",
  "releaseId": 12345,
  "notes": "## Features\n\n- New webhook system",
  "prerelease": false
}'
```

---

#### `release.update`

**Description:** Update a draft release without publishing it. Draft-first semantics
enforced — use only when release state is draft.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| releaseId | integer | yes | Release ID (1+) |
| tagName | string | no | Updated tag name |
| title | string | no | Updated release title |
| notes | string | no | Updated release notes |
| targetCommitish | string | no | Updated target commit/ref |
| prerelease | boolean | no | Prerelease flag |
| draft | boolean | no | Should remain true for draft |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Release ID |
| tagName | string or null | Tag name |
| name | string or null | Release title |
| isDraft | boolean | true |
| isPrerelease | boolean | Prerelease flag |
| url | string or null | Release URL |
| targetCommitish | string or null | Target ref |
| createdAt | string or null | ISO timestamp |
| publishedAt | string or null | Null for drafts |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run release.update --input '{
  "owner": "octocat",
  "name": "hello-world",
  "releaseId": 12345,
  "title": "Version 2.0.0 - Major Release",
  "notes": "## Bug Fixes\n\n- Fixed webhook retry logic",
  "draft": true
}'
```
