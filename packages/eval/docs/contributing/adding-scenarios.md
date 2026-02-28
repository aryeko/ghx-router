# Adding Scenarios

Step-by-step guide for contributing new evaluation scenarios to `@ghx-dev/eval`.

## When to Add a Scenario

- A new ghx capability is added and needs evaluation coverage
- An edge case is discovered that existing scenarios do not exercise
- A regression occurred and a scenario can prevent recurrence
- A new agent provider or mode needs baseline measurements

## Checklist

Follow these steps when adding a scenario:

### 1. Create the Scenario File

Add a JSON file in `scenarios/` following the ID convention (`<domain>-<action>-<variant>`). The file must conform to the scenario schema.

### 2. Define Fixture Requirements

Specify the GitHub fixtures the scenario depends on (repositories, issues, pull requests). Document any prerequisite state the fixture must be in before the evaluation runs.

### 3. Write Checkpoints

Define checkpoints that verify the agent completed the task correctly. Each checkpoint should assert a single, observable outcome. See [Writing Scenarios](../guides/writing-scenarios.md) for checkpoint condition syntax.

### 4. Add to a Scenario Set

Register the scenario in the appropriate scenario set so it runs as part of the standard evaluation suite.

### 5. Validate the Scenario

Run the schema validator to confirm the scenario file is well-formed:

```bash
pnpm --filter @ghx-dev/eval run eval check
```

### 6. Run in All Three Modes

Execute the scenario across all evaluation modes to verify it behaves correctly in each context:

```bash
pnpm --filter @ghx-dev/eval run eval run --scenario <id> --mode ghx
pnpm --filter @ghx-dev/eval run eval run --scenario <id> --mode mcp
pnpm --filter @ghx-dev/eval run eval run --scenario <id> --mode baseline
```

### 7. Verify Test Coverage

If the scenario required new source code (loaders, custom collectors, checkpoint logic), confirm that test coverage remains at 90% or above:

```bash
pnpm --filter @ghx-dev/eval run test:coverage
```

## Tips

- Keep scenarios focused on a single capability or workflow
- Prefer deterministic checkpoints over heuristic assertions
- Reuse existing fixtures when possible to minimize setup overhead
- Name scenario files descriptively so their purpose is clear from the filename alone

## Related Documentation

- [Writing Scenarios](../guides/writing-scenarios.md) -- detailed walkthrough of scenario authoring
- [Managing Fixtures](../guides/managing-fixtures.md) -- how to create and manage test fixtures
- [Scenarios Architecture](../architecture/scenarios.md) -- how scenarios are loaded and executed
- [Contributing Hub](./README.md)
