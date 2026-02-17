# Check Run Capabilities

Check run capabilities provide detailed inspection of check annotations — retrieve
annotation messages, paths, line ranges, and severity levels from completed check runs.

## Capabilities

### Annotations

#### `check_run.annotations.list`

**Description:** List annotations for one check run. Annotations include linting issues,
security warnings, and other detailed check results.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| checkRunId | integer | yes | Check run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Annotations (path, startLine, endLine, level, message, title, details) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run check_run.annotations.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "checkRunId": 567890
}'
```

**Response Example:**

Each annotation includes:

| Field | Type | Description |
|-------|------|-------------|
| path | string or null | File path relative to repo root |
| startLine | integer or null | Starting line number |
| endLine | integer or null | Ending line number |
| level | string or null | Severity (notice, warning, failure) |
| message | string or null | Annotation message |
| title | string or null | Annotation title |
| details | string or null | Additional details or code snippet |
