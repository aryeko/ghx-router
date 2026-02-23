---
"@ghx-dev/core": patch
---

Improve `pr.reviews.submit` schema and capabilities list output.

- Add `startLine` and `startSide` fields to `pr.reviews.submit` for multi-line comment ranges
- Document the `side` vs `diffSide` naming asymmetry between submit input and `pr.threads.list` output
- Annotate `body` conditionality: required for `COMMENT`/`REQUEST_CHANGES`, optional for `APPROVE`
- Clarify `pr.reviews.list` description to note it returns review-level metadata only (not inline thread comments)
- Show array item field hints in `capabilities list` text output (e.g. `comments?[path, body, line, side?, startLine?, startSide?]`)
