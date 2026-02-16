# Roadmap Golden Flows (Batches A-D)

This guide provides one end-to-end reference flow per roadmap batch.

## Setup + Discovery (Track 0)

```bash
ghx setup --scope project --yes
ghx setup --scope project --verify
ghx capabilities list
ghx capabilities explain pr.merge.execute
```

## Batch A: PR Execution Loop

```bash
ghx run pr.review.submit_comment --input '{"owner":"acme","name":"widget","number":123,"body":"Looks good overall"}'
ghx run pr.checks.rerun_failed --input '{"owner":"acme","name":"widget","number":123}'
ghx run pr.merge.execute --input '{"owner":"acme","name":"widget","number":123,"method":"squash"}'
ghx run pr.branch.update --input '{"owner":"acme","name":"widget","number":123,"expected_head_sha":"<sha>"}'
```

## Batch B: Issue Lifecycle + Dependencies

```bash
ghx run issue.create --input '{"owner":"acme","name":"widget","title":"Follow-up task","body":"Track post-merge cleanup"}'
ghx run issue.labels.update --input '{"owner":"acme","name":"widget","number":456,"labels":["enhancement","triage"]}'
ghx run issue.parent.set --input '{"owner":"acme","name":"widget","number":456,"parent_number":300}'
ghx run issue.blocked_by.add --input '{"owner":"acme","name":"widget","number":456,"blocked_by_number":301}'
ghx run issue.close --input '{"owner":"acme","name":"widget","number":456}'
```

## Batch C: Release + Delivery

```bash
ghx run release.create_draft --input '{"owner":"acme","name":"widget","tag_name":"v1.2.0","target_commitish":"main","name":"v1.2.0"}'
ghx run release.update --input '{"owner":"acme","name":"widget","release_id":"<release-id>","body":"Release notes"}'
ghx run release.publish_draft --input '{"owner":"acme","name":"widget","release_id":"<release-id>"}'
ghx run workflow_dispatch.run --input '{"owner":"acme","name":"widget","workflow_id":"release.yml","ref":"main"}'
ghx run workflow_run.rerun_failed --input '{"owner":"acme","name":"widget","run_id":999999}'
```

## Batch D: Workflow Controls + Projects v2

```bash
ghx run workflow.get --input '{"owner":"acme","name":"widget","workflow_id":"ci.yml"}'
ghx run workflow_run.get --input '{"owner":"acme","name":"widget","run_id":999999}'
ghx run workflow_run.artifacts.list --input '{"owner":"acme","name":"widget","run_id":999999}'
ghx run project_v2.fields.list --input '{"organization":"acme","project_number":12}'
ghx run project_v2.item.field.update --input '{"project_id":"PVT_xxx","item_id":"PVTI_xxx","field_id":"PVTF_xxx","value":{"single_select_option_id":"opt_xxx"}}'
```

Notes:

- Use dedicated fixtures for mutating capabilities.
- Keep destructive operations (for example `issue.delete`) outside shared fixtures.
- For benchmark parity, map flows to `pr-exec`, `issues`, `release-delivery`, `workflows`, and `projects-v2` scenario sets.
