# Operation Card Registry

Operation cards are the runtime source of truth for capabilities.

## Card Contents

- capability id, version, description
- input schema + output schema
- routing policy (`preferred`, `fallbacks`)
- optional GraphQL/CLI metadata (CLI metadata is optional and non-executable in v1)

## Current v1 Capabilities

- `repo.view`
- `issue.view`
- `issue.list`
- `issue.comments.list`
- `pr.view`
- `pr.list`

## Runtime Behavior

- cards are loaded from `packages/ghx-router/src/core/registry/cards/*.yaml`
- cards are schema-validated at startup in `packages/ghx-router/src/core/registry/index.ts`
- routing registry derives from cards

## Adding a Capability

1. add a new card with input/output schema and route policy
2. add adapter coverage (GraphQL and/or CLI)
3. add unit/integration tests
4. add benchmark scenario
