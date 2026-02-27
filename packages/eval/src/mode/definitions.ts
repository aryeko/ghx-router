export const BASELINE_INSTRUCTIONS = `\
Use the \`gh\` CLI tool directly for all GitHub operations. You have \`gh\` installed and authenticated.

Common commands:
- gh pr view <number> --json <fields>
- gh pr list --json <fields>
- gh api graphql -f query='...'
- gh issue view <number> --json <fields>

Parse the output as needed. Use --json flag for structured output when available.
`

export const MCP_INSTRUCTIONS = `\
You have access to GitHub tools via the MCP server. Use the available MCP tools to interact with GitHub.
The tools provide structured input/output.

Available tool categories:
- Pull requests: view, list, create, update, merge
- Issues: view, list, create, update
- Repositories: view, list files, get content
- Reviews: list, create, submit
- Branches: list, create, delete

Use the tool listing to discover available tools and their parameters.
`

export const GHX_SKILL_FALLBACK = `\
Use ghx CLI for GitHub operations. Run: ghx run <capability> --input '{"...": "..."}'
`
