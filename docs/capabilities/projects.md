# Projects V2 Capabilities

Projects V2 capabilities enable management of GitHub's next-generation project boards —
discover projects, manage fields, track items, and update item field values.

## Capabilities

### Discovery

#### `project_v2.org.get`

**Description:** Get an organization Projects v2 project.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| org | string | yes | Organization name |
| projectNumber | integer | yes | Project number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string or null | Project ID |
| title | string or null | Project title |
| shortDescription | string or null | Project description |
| public | boolean or null | true if public |
| closed | boolean or null | true if closed |
| url | string or null | Project URL |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run project_v2.org.get --input '{
  "org": "myorg",
  "projectNumber": 5
}'
```

---

#### `project_v2.user.get`

**Description:** Get a user Projects v2 project.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user | string | yes | GitHub username |
| projectNumber | integer | yes | Project number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| id | string or null | Project ID |
| title | string or null | Project title |
| shortDescription | string or null | Project description |
| public | boolean or null | true if public |
| closed | boolean or null | true if closed |
| url | string or null | Project URL |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run project_v2.user.get --input '{
  "user": "octocat",
  "projectNumber": 2
}'
```

---

### Fields

#### `project_v2.fields.list`

**Description:** List fields for a Projects v2 project.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Organization or user name |
| projectNumber | integer | yes | Project number (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Fields (id, name, dataType) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run project_v2.fields.list --input '{
  "owner": "myorg",
  "projectNumber": 5
}'
```

---

### Items

#### `project_v2.items.list`

**Description:** List items in a Projects v2 project.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Organization or user name |
| projectNumber | integer | yes | Project number (1+) |
| first | integer | no | Number of items per page (1+) |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| items | array | Items (id, contentType, contentNumber, contentTitle) |
| pageInfo | object | Pagination (hasNextPage, endCursor) |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run project_v2.items.list --input '{
  "owner": "myorg",
  "projectNumber": 5,
  "first": 50
}'
```

---

#### `project_v2.item.add_issue`

**Description:** Add an issue to a Projects v2 project.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| owner | string | yes | Organization or user name |
| projectNumber | integer | yes | Project number (1+) |
| issueUrl | string | yes | Full issue URL |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| itemId | string or null | Project item ID |
| added | boolean | true if added |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run project_v2.item.add_issue --input '{
  "owner": "myorg",
  "projectNumber": 5,
  "issueUrl": "https://github.com/octocat/hello-world/issues/42"
}'
```

---

### Item Field Updates

#### `project_v2.item.field.update`

**Description:** Update a field on a Projects v2 project item.

**Input:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| projectId | string | yes | Project ID (node ID) |
| itemId | string | yes | Item ID (node ID) |
| fieldId | string | yes | Field ID (node ID) |
| valueText | string | no | Text field value |
| valueNumber | number | no | Numeric field value |
| valueDate | string | no | Date field value |
| valueSingleSelectOptionId | string | no | Single-select option ID |
| valueIterationId | string | no | Iteration ID |
| clear | boolean | no | Clear field value |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| itemId | string or null | Item ID |
| updated | boolean | true |

**Routes:** cli (preferred)

**Example:**

```bash
npx ghx run project_v2.item.field.update --input '{
  "projectId": "PVT_kwDOB8Aq000AAA",
  "itemId": "PVTI_kwDOB8Aq000A001",
  "fieldId": "PVTF_kwDOB8Aq000A002",
  "valueSingleSelectOptionId": "f235d32d"
}'
```

Alternatively, to update a text field:

```bash
npx ghx run project_v2.item.field.update --input '{
  "projectId": "PVT_kwDOB8Aq000AAA",
  "itemId": "PVTI_kwDOB8Aq000A001",
  "fieldId": "PVTF_kwDOB8Aq000A002",
  "valueText": "In Progress"
}'
```

Or to clear a field:

```bash
npx ghx run project_v2.item.field.update --input '{
  "projectId": "PVT_kwDOB8Aq000AAA",
  "itemId": "PVTI_kwDOB8Aq000A001",
  "fieldId": "PVTF_kwDOB8Aq000A002",
  "clear": true
}'
```
