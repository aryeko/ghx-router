# Roadmap

## v1 (Current)

- Shipped capabilities: `repo.view`, `issue.view`, `issue.list`, `issue.comments.list`, `pr.view`, `pr.list`
- CLI-first routing with GraphQL/CLI adapters
- Benchmark harness comparing agent-direct vs ghx execution
- Normalized envelope contract and structured error taxonomy

## v1.x

- **More capabilities:** PR reviews, workflow dispatch, releases, search
- **npm publish:** Publish `@ghx/core` and `@ghx/benchmark` to npm
- **MCP server mode:** Expose ghx capabilities via Model Context Protocol
- **REST adapter:** Activate REST fallback for select capabilities

## v2

- **Plugin system:** Custom operation cards and adapters
- **Multi-provider support:** Extend beyond GitHub (e.g., GitLab, Bitbucket)
- **Configuration:** Per-repo or per-org routing preferences

## Contributing to the Roadmap

Have ideas or want to influence priorities? Open a [Discussion](https://github.com/aryeko/ghx-router/discussions) or an [Issue](https://github.com/aryeko/ghx-router/issues).
