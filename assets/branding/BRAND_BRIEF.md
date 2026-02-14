# ghx Brand Brief

This brief locks the branding direction for `ghx` and defines what ships as final.

## 1) Brand Goal

Position `ghx` as a state-of-the-art open-source infrastructure tool that feels:

- technically precise
- reliable under pressure
- fast to understand and adopt

If users see one social preview or one favicon, they should immediately read it as a modern developer tool, not a generic AI product.

## 2) Locked Visual Direction

Use this direction only:

- **Identity system:** Grid + Arrow
- **Social anchor reference:** `assets/branding/social/ghx-social-dark-1280x640.png`
- **Logo anchor reference:** `assets/branding/logos/ghx-logo-icon.svg`

Interpretation of the mark:

- Grid = execution space, graph, and structured operations
- Arrow = routed action, forward execution, deterministic path

## 3) Audience and Positioning

Primary audience:

- OSS maintainers
- AI tooling builders
- backend/infra engineers

Positioning line:

`ghx` is the GitHub execution router for AI agents.

Trust signals to optimize for:

- clean geometry over decorative effects
- explicit product value prop in social assets
- repeatable system that scales from favicon to social card

## 4) Non-Negotiables

1. Keep logos flat and geometric (no glow, blur, texture, or glass effects).
2. Preserve a simple silhouette that survives at `16x16` and `32x32`.
3. Never use mascot-like forms or AI swirl cliches.
4. No purple-heavy palette.
5. Social card must include the exact text: `ghx` and `GitHub execution router for AI agents`.
6. Prefer information clarity over stylistic novelty.

## 5) Logo System Rules

Required logo set:

- icon-only mark
- icon + `ghx` lockup for dark surfaces
- icon + `ghx` lockup for light surfaces

Geometry rules:

- orthogonal grid logic and consistent stroke weights
- arrow motion should be unmistakable at small sizes
- rounded corners are allowed only if subtle and consistent
- balanced negative space around arrow path intersections

Usage rules:

- transparent backgrounds for all logo exports
- monochrome variant must remain recognizable
- avoid overly thin strokes that collapse under rasterization

## 6) Social Preview Rules

Canvas target: `1280x640`.

Composition rules:

- clear hierarchy: logo/mark -> `ghx` -> value prop
- background can include subtle network/grid atmosphere only
- keep generous safe margins for GitHub/X crops
- maintain high contrast for text and mark

Allowed text blocks:

- `ghx`
- `GitHub execution router for AI agents`
- optional footer: `@ghx-dev/core`

## 7) Color and Tone

Use this base palette family (exact values may be tuned for contrast):

- dark ink: `#0A1220`
- deep navy: `#0F2747`
- teal accent: `#0EA5A4`
- mint accent: `#A7F3D0`
- light neutral: `#F1F5F9`

Tone keywords:

- precise
- infrastructural
- modern
- calm confidence

## 8) Exclusions

Do not ship styles that look like:

- molecule/science iconography
- swoosh/person/check startup marks
- glossy app-icon gradients for the core logo
- dense detail that breaks at favicon sizes

## 9) Done Criteria

Branding is complete when all are true:

- Final exports in `assets/branding/` match `ASSET_TARGETS.md`.
- Favicon legibility validated at `16x16`, `24x24`, and `32x32`.
- Dark and light lockups both pass contrast checks.
- Social card reads clearly in timeline previews.
- `README.md` and repo social preview use the new final assets.
