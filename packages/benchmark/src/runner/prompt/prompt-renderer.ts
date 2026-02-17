import type { BenchmarkMode, Scenario } from "../../domain/types.js"

export function modeScopedAssertions(
  scenario: Scenario,
  mode: BenchmarkMode,
): Scenario["assertions"] {
  if (mode === "ghx") {
    const hasGithubToken =
      typeof process.env.GITHUB_TOKEN === "string" && process.env.GITHUB_TOKEN.trim().length > 0
    const hasGhToken =
      typeof process.env.GH_TOKEN === "string" && process.env.GH_TOKEN.trim().length > 0

    if (scenario.assertions.expected_route_used === "graphql" && !hasGithubToken && !hasGhToken) {
      const { expected_route_used: _expectedRoute, ...base } = scenario.assertions
      return base
    }

    return scenario.assertions
  }

  const { expected_route_used: _ignoredExpectedRouteUsed, ...baseAssertions } = scenario.assertions

  return {
    ...baseAssertions,
    required_meta_fields: (scenario.assertions.required_meta_fields ?? []).filter(
      (field) => field !== "route_used",
    ),
  }
}

export function renderPrompt(
  scenario: Scenario,
  mode: BenchmarkMode,
  benchmarkNonce?: string,
): string {
  const scopedAssertions = modeScopedAssertions(scenario, mode)
  const rendered = scenario.prompt_template
    .replaceAll("{{task}}", scenario.task)
    .replaceAll("{{scenario_id}}", scenario.id)
    .replaceAll("{{input_json}}", JSON.stringify(scenario.input))
    .replaceAll("{{fixture_repo}}", scenario.fixture?.repo ?? "")

  const fixtureNote = scenario.fixture?.repo ? `Target repository: ${scenario.fixture.repo}.` : ""
  const requiredDataFields = scopedAssertions.required_data_fields ?? []
  const requiredMetaFields = scopedAssertions.required_meta_fields ?? []
  const dataContract =
    requiredDataFields.length > 0
      ? `The JSON data object MUST include: ${requiredDataFields.join(", ")}.`
      : "The JSON data field may be object or array based on task output."
  const metaContract =
    requiredMetaFields.length > 0
      ? `The JSON meta object MUST include: ${requiredMetaFields.join(", ")}.`
      : "The JSON meta object can include optional diagnostic fields."
  const routeContract =
    scopedAssertions.expected_route_used !== undefined
      ? `meta.route_used MUST be exactly "${scopedAssertions.expected_route_used}".`
      : ""
  const failFastContract =
    mode === "ghx"
      ? "If the ghx command fails, return the final envelope JSON immediately. Do not run extra debugging commands."
      : ""

  const nonceLine = benchmarkNonce ? `Benchmark nonce: ${benchmarkNonce}` : ""

  const promptLines = [
    fixtureNote,
    nonceLine,
    "You MUST use real tools to gather data. Do not fabricate outputs.",
    "Return STRICT JSON only. No markdown fences.",
    "Output must be exactly one JSON object with keys: ok, data, error, meta.",
    dataContract,
    metaContract,
    routeContract,
    failFastContract,
  ].filter((line) => line.length > 0)

  return `${promptLines.join("\n")}\n\n${rendered}`
}

export function buildOutputSchema(assertions: Scenario["assertions"]): Record<string, unknown> {
  const requiredDataFields = assertions.required_data_fields ?? []
  const requiredMetaFields = assertions.required_meta_fields ?? []

  const dataProperties: Record<string, unknown> = {}
  for (const field of requiredDataFields) {
    if (field === "items") {
      dataProperties.items = {
        type: "array",
      }
      continue
    }

    if (field === "pageInfo") {
      dataProperties.pageInfo = {
        type: "object",
        required: ["hasNextPage", "endCursor"],
        properties: {
          hasNextPage: { type: "boolean" },
          endCursor: { type: ["string", "null"] },
        },
      }
      continue
    }

    dataProperties[field] = {
      anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "object" }],
    }
  }

  const metaProperties: Record<string, unknown> = {
    route_used: {
      type: "string",
    },
    attempts: {
      type: "array",
      items: {
        type: "object",
      },
    },
  }

  for (const field of requiredMetaFields) {
    if (!metaProperties[field]) {
      metaProperties[field] = {
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "array" },
          { type: "object" },
          { type: "null" },
        ],
      }
    }
  }

  return {
    type: "object",
    additionalProperties: false,
    required: ["ok", "data", "error", "meta"],
    properties: {
      ok: { type: "boolean" },
      data: {
        type: "object",
        required: requiredDataFields,
        properties: dataProperties,
        additionalProperties: true,
      },
      error: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: true,
            required: ["code", "message", "retryable", "details"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              retryable: { type: "boolean" },
              details: { type: "object", additionalProperties: true },
            },
          },
        ],
      },
      meta: {
        type: "object",
        required: requiredMetaFields,
        properties: metaProperties,
        additionalProperties: true,
      },
    },
  }
}

export function forcedToolCommandHint(scenario: Scenario, mode: BenchmarkMode): string {
  const owner = String((scenario.input.owner ?? "").toString())
  const name = String((scenario.input.name ?? "").toString())
  const repo = owner && name ? `${owner}/${name}` : (scenario.fixture?.repo ?? "")
  const first = typeof scenario.input.first === "number" ? scenario.input.first : 20
  const state = String((scenario.input.state ?? "open").toString())
  const issueNumber =
    typeof scenario.input.issueNumber === "number" ? scenario.input.issueNumber : 1
  const prNumber = typeof scenario.input.prNumber === "number" ? scenario.input.prNumber : 1

  if (mode === "ghx") {
    return `ghx run ${scenario.task} --input '${JSON.stringify(scenario.input)}'`
  }

  switch (scenario.task) {
    case "issue.comments.list":
      return `gh api repos/${repo}/issues/${issueNumber}/comments?per_page=${first}&page=1`
    case "issue.list":
      return `gh issue list --repo ${repo} --state ${state} --limit ${first} --json id,number,title,state,url`
    case "pr.list":
      return `gh pr list --repo ${repo} --state ${state} --limit ${first} --json id,number,title,state,url`
    case "issue.view":
      return `gh issue view ${issueNumber} --repo ${repo} --json id,number,title,state,url`
    case "pr.view":
      return `gh pr view ${prNumber} --repo ${repo} --json id,number,title,state,url`
    case "repo.view":
      return `gh repo view ${repo} --json id,name,nameWithOwner,isPrivate,stargazerCount,forkCount,url,defaultBranchRef`
    default:
      return "gh --version"
  }
}
