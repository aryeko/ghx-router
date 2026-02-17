# Workflow Capabilities

Workflow capabilities manage GitHub Actions workflows and their runs — list, trigger,
monitor, cancel, and analyze workflow executions.

## Capabilities

### Workflows

#### `workflow.list`

**Description:** List repository workflows.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| first | integer | no | Number of items per page (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Workflows (id, name, path, state) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "first": 20
}'
```

---

#### `workflow.get`

**Description:** Get one repository workflow.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| workflowId | string or integer | yes | Workflow ID (name or numeric ID) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Workflow ID |
| name | string or null | Workflow name |
| path | string or null | Workflow file path |
| state | string or null | Workflow state |
| url | string or null | Workflow URL |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow.get --input '{
  "owner": "octocat",
  "name": "hello-world",
  "workflowId": "ci.yml"
}'
```

---

### Dispatch

#### `workflow_dispatch.run`

**Description:** Trigger a workflow dispatch event.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| workflowId | string | yes | Workflow ID or name |
| ref | string | yes | Branch, tag, or commit SHA |
| inputs | object | no | Workflow input values (string, number, boolean) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| workflowId | string | Workflow ID |
| ref | string | Target ref |
| dispatched | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_dispatch.run --input '{
  "owner": "octocat",
  "name": "hello-world",
  "workflowId": "deploy.yml",
  "ref": "main",
  "inputs": {
    "environment": "production",
    "debug": true
  }
}'
```

---

### Runs

#### `workflow_runs.list`

**Description:** List workflow runs for a repository.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| first | integer | no | Number of items per page (1+) |
| branch | string | no | Filter by branch name |
| event | string | no | Filter by event type |
| status | string | no | Filter by status |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Runs (id, workflowName, status, conclusion, headBranch, url) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_runs.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "first": 20,
  "branch": "main",
  "status": "completed"
}'
```

---

#### `workflow_run.get`

**Description:** Get a workflow run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Run ID |
| workflowName | string or null | Workflow name |
| status | string or null | Status (in_progress, completed) |
| conclusion | string or null | Conclusion (success, failure, cancelled) |
| headBranch | string or null | Branch name |
| headSha | string or null | Commit SHA |
| event | string or null | Trigger event type |
| createdAt | string or null | ISO timestamp |
| updatedAt | string or null | ISO timestamp |
| startedAt | string or null | ISO timestamp |
| url | string or null | Run URL |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_run.get --input '{
  "owner": "octocat",
  "name": "hello-world",
  "runId": 123456789
}'
```

---

### Jobs

#### `workflow_run.jobs.list`

**Description:** List jobs in a workflow run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Jobs (id, name, status, conclusion, startedAt, completedAt, url) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_run.jobs.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "runId": 123456789
}'
```

---

### Run Control

#### `workflow_run.cancel`

**Description:** Cancel a workflow run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| runId | integer | Workflow run ID |
| status | string | cancel_requested |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_run.cancel --input '{
  "owner": "octocat",
  "name": "hello-world",
  "runId": 123456789
}'
```

---

#### `workflow_run.rerun_all`

**Description:** Rerun all jobs in a workflow run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| runId | integer | Workflow run ID |
| status | string | requested |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_run.rerun_all --input '{
  "owner": "octocat",
  "name": "hello-world",
  "runId": 123456789
}'
```

---

#### `workflow_run.rerun_failed`

**Description:** Rerun failed jobs for a workflow run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| runId | integer | Workflow run ID |
| rerunFailed | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_run.rerun_failed --input '{
  "owner": "octocat",
  "name": "hello-world",
  "runId": 123456789
}'
```

---

### Artifacts

#### `workflow_run.artifacts.list`

**Description:** List artifacts for a workflow run.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| runId | integer | yes | Workflow run ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Artifacts (id, name, sizeInBytes, archiveDownloadUrl) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_run.artifacts.list --input '{
  "owner": "octocat",
  "name": "hello-world",
  "runId": 123456789
}'
```

---

### Job Logs

#### `workflow_job.logs.get`

**Description:** Fetch logs for a workflow job.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| jobId | integer | yes | Job ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| jobId | integer | Job ID |
| log | string | Full log text |
| truncated | boolean | true if log was truncated |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_job.logs.get --input '{
  "owner": "octocat",
  "name": "hello-world",
  "jobId": 987654321
}'
```

---

#### `workflow_job.logs.analyze`

**Description:** Fetch and analyze workflow job logs to identify errors and warnings.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Repository owner |
| name | string | yes | Repository name |
| jobId | integer | yes | Job ID (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| jobId | integer | Job ID |
| truncated | boolean | true if log was truncated |
| summary | object | Analysis (errorCount, warningCount, topErrorLines) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run workflow_job.logs.analyze --input '{
  "owner": "octocat",
  "name": "hello-world",
  "jobId": 987654321
}'
```
