# Guides

Practical how-to documentation for using ghx in your project or AI agent.

## For Developers Using ghx

**[CLI Usage](cli-usage.md)** — Command reference for the `ghx` CLI

Start here if you're running ghx commands from the terminal.

- `npx ghx run` — Execute a capability
- `npx ghx capabilities list` — List all 70 capabilities
- `npx ghx capabilities explain` — Understand a capability's contract

**[Library API](library-api.md)** — Programmatic access in Node.js

Use ghx in your JavaScript or TypeScript code with the `@ghx-dev/core` package.

- `executeTask()` — Run a capability programmatically
- `executeTasks()` — Run a chain of mutations atomically (≤2 HTTP round-trips)
- `listOperationCards()` — Inspect the registry
- `createGithubClientFromToken()` — Create a GitHub client

**[Chaining Capabilities](chaining-capabilities.md)** — Atomic multi-step mutations

Run multiple mutations in a single logical operation using `executeTasks()` or `ghx chain`.

- Two-phase execution model (resolution query + mutation batch)
- `ChainResultEnvelope` / `ChainStatus` / `ChainStepResult` types
- Pre-flight validation before any HTTP call
- Which capabilities support chaining

**[Custom GraphQL Transport](custom-graphql-transport.md)** — Bring your own GraphQL client

Override the default GraphQL implementation with your own transport.

- Custom fetch logic
- Authorization handling
- Enterprise deployments

## For AI Agent Developers

**[Agent Integration](agent-integration.md)** — Add ghx to your coding agent

Learn how to set up ghx for agents like Claude Code, GitHub Copilot, or custom LLM
systems.

- The three agent tools: `createExecuteTool()`, `listCapabilities()`,
  `explainCapability()`
- System prompts and agent onboarding
- Handling result envelopes in your agent loop

**[Understanding the Result Envelope](result-envelope.md)** — The response format

Every ghx call returns a stable envelope. Learn how to parse it and handle responses.

- Structure of `{ ok, data, error, meta }`
- Reading metadata about routing decisions
- Understanding attempt history

## Concepts and Troubleshooting

**[How Routing Works](routing-explained.md)** — User-friendly routing explanation

Understand how ghx decides whether to use CLI, GraphQL, or REST.

- Preferred routes and fallbacks
- Preflight checks (CLI availability, auth)
- Deterministic behavior

**[Error Handling & Codes](error-handling.md)** — Error taxonomy and troubleshooting

What error codes mean and how to fix them.

- Error codes: `AUTH`, `VALIDATION`, `RATE_LIMIT`, `NETWORK`, `SERVER`, etc.
- Retryable vs. non-retryable errors
- Debugging strategies

---

## Quick Links

- [Operation Cards](../architecture/operation-cards.md) — Full API reference
- [Getting Started](../getting-started/README.md) — Installation and first task
- [Architecture](../architecture/README.md) — Deep dives on system design
