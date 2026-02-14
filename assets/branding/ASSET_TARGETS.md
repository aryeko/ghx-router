# Asset Targets

Canonical release assets for `ghx` should be generated into this directory tree.

Direction lock: Grid + Arrow identity from `assets/branding/BRAND_BRIEF.md`.

## Logos (`logos/`)

- `ghx-logo-icon.svg` - primary icon, flat style, transparent background
- `ghx-logo-icon.png` - 1024x1024 export of primary icon
- `ghx-logo-lockup-dark.svg` - icon + wordmark for dark surfaces
- `ghx-logo-lockup-dark.png` - 2400x800 export
- `ghx-logo-lockup-light.svg` - icon + wordmark for light surfaces
- `ghx-logo-lockup-light.png` - 2400x800 export

## Social (`social/`)

- `ghx-social-dark-1280x640.png` - GitHub/Open Graph card (dark)
- `ghx-social-light-1280x640.png` - GitHub/Open Graph card (light)

## Favicons (`favicons/`)

- `ghx-favicon-16.png`
- `ghx-favicon-32.png`
- `ghx-apple-touch-180.png`

## Production Rules

- Logos stay flat (no glow/blur baked into logo assets)
- Social cards may use subtle glow/atmospheric effects
- Keep lockup text high contrast and readable at small sizes
- Validate legibility at `16`, `24`, and `32` pixels

## Current Status

- [x] `logos/ghx-logo-icon.png`
- [x] `logos/ghx-logo-icon.svg`
- [x] `logos/ghx-logo-lockup-dark.svg`
- [x] `logos/ghx-logo-lockup-dark.png`
- [x] `logos/ghx-logo-lockup-light.svg`
- [x] `logos/ghx-logo-lockup-light.png`
- [x] `social/ghx-social-dark-1280x640.png`
- [x] `social/ghx-social-light-1280x640.png`
- [x] `favicons/ghx-favicon-16.png`
- [x] `favicons/ghx-favicon-32.png`
- [x] `favicons/ghx-apple-touch-180.png`

Notes:

- Any remaining unchecked assets should be treated as pre-lock placeholders and regenerated.
- Dark social and logo/favicons were regenerated from the locked Grid + Arrow SVG/PNG workflow.
- Use `assets/branding/BRAND_BRIEF.md` and `assets/branding/ASSET_TARGETS.md` as the canonical execution set.
