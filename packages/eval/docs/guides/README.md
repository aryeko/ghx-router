# Guides

Practical walkthroughs for writing scenarios, managing fixtures, configuring evaluations, and interpreting reports.

## Available Guides

| Guide | Description |
|-------|-------------|
| [Writing Scenarios](./writing-scenarios.md) | Step-by-step guide to creating evaluation scenarios with fixtures and checkpoints |
| [Managing Fixtures](./managing-fixtures.md) | Seed, reset, and cleanup GitHub test fixtures |
| [Configuration](./configuration.md) | Full reference for `eval.config.yaml`, CLI flags, and environment variables |
| [Running Evaluations](./running-evaluations.md) | CLI commands, flags, and interpreting output |
| [Custom Collectors](./custom-collectors.md) | Extend GhxCollector or create new collectors for domain-specific metrics |
| [Reports](./reports.md) | Output formats, directory structure, and interpreting results |

## Where to Start

If you are writing new scenarios, start with [Writing Scenarios](./writing-scenarios.md). That guide covers fixture bindings, checkpoint assertions, and template variables end to end.

If you are running existing evaluations, start with [Configuration](./configuration.md) to understand the config file and CLI flags, then move to [Running Evaluations](./running-evaluations.md).

## Related Documentation

- [Quick Start](../getting-started/quick-start.md) -- run a single evaluation scenario from config to report
- [Core Concepts](../getting-started/concepts.md) -- modes, fixtures, checkpoints, and the execution matrix
- [Plugin Contracts](../../../agent-profiler/docs/architecture/plugin-contracts.md) -- full interface definitions for all six profiler contracts
- [Architecture Overview](../architecture/overview.md) -- system design and data flow
