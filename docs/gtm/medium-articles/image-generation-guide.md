# Image Generation Guide for ghx Medium Articles

This document provides detailed generation prompts for AI image generators (DALL-E 3, Midjourney, Ideogram, or Flux) and design specifications for manually crafted visuals.

## Brand Color Palette (Reference)

| Name | Hex | Usage |
|------|-----|-------|
| Dark ink | `#0A1220` | Backgrounds |
| Deep navy | `#0F2747` | Cards, containers |
| Teal accent | `#0EA5A4` | Primary accent, lines, highlights |
| Mint accent | `#A7F3D0` | Success states, secondary accent |
| Light neutral | `#F1F5F9` | Text on dark backgrounds |
| Error red | `#DC2626` | Error/failure indicators |
| Warning amber | `#F59E0B` | Caution states |

---

## Image 1: Hero / Featured Image

**Purpose:** Medium article featured image (Article 1). First thing readers see.
**Dimensions:** 1400x800px (Medium's recommended featured image size)
**Filename:** `hero-token-tax.png`

### Generation Prompt (DALL-E 3 / Midjourney)

> A minimal, technical illustration on a dark navy background (#0F2747). On the left side, show a tangled, glowing web of disconnected nodes and broken paths in muted red and purple — representing chaotic, ad-hoc GitHub agent workflows. On the right side, show the same nodes cleanly organized into a geometric grid with teal (#0EA5A4) glowing paths connecting them in orderly lines, with a single directional arrow flowing through the center. The visual should communicate "chaos to order" and feel like a modern developer tool's architecture diagram. Flat design, no text, no humans, no logos. Clean, infrastructural aesthetic. Dark background. No gradients except subtle glow on the teal paths.

### Alternative Prompt (More Abstract)

> Abstract technical illustration: dark navy background. Left half shows scattered, disconnected geometric shapes (hexagons, circles, squares) with faint red connecting lines that dead-end and loop back. Right half shows the same shapes aligned on a precise grid with clean teal lines flowing in one direction through an arrow-shaped corridor. A subtle gradient divides the two halves. The mood is: structured precision replacing chaotic improvisation. Flat vector style, developer-tool aesthetic. No text.

### Manual Design Option (Figma/Excalidraw)

Create a side-by-side:
- **Left ("Before"):** Messy node graph with:
  - Scattered `gh` CLI icons
  - Looping arrows
  - Question marks at routing decisions
  - Red/orange error indicators
  - Label: "Ad-hoc agent execution"
- **Right ("After"):** Clean pipeline flow with:
  - Ordered capability cards
  - Single directional flow
  - Teal routing lines
  - Green checkmarks at validation gates
  - Label: "ghx capability routing"

---

## Image 2: Architecture Diagram (Polished)

**Purpose:** Replace Mermaid diagram with a professional version for the architecture section
**Dimensions:** 1400x900px
**Filename:** `architecture-polished.png`

### Design Spec (Figma/Sketch/Excalidraw)

Create a layered architecture diagram with these components arranged top-to-bottom:

```
┌──────────────────────────────────────────┐
│  CALLER: capability ID + input JSON      │ ← Light neutral card
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│  📋 CAPABILITY REGISTRY                   │
│  Operation cards (YAML)                  │ ← Deep navy card
│  Schemas · Routes · Metadata             │
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│  ✅ INPUT VALIDATION (AJV)               │ ← Teal border
└─────────────────┬────────────────────────┘
                  │
┌─────────────────▼────────────────────────┐
│  🧭 ROUTE PLANNER                        │
│  preferred → fallback₁ → fallback₂      │ ← Deep navy card
└────┬────────────┬────────────┬───────────┘
     │            │            │
┌────▼───┐  ┌────▼───┐  ┌────▼───┐
│ CLI    │  │ GraphQL│  │  REST  │           ← Blue adapter cards
│Adapter │  │Adapter │  │Adapter │
└────┬───┘  └────┬───┘  └────┬───┘
     └────────────┼────────────┘
                  │
┌─────────────────▼────────────────────────┐
│  📦 RESULT ENVELOPE                      │
│  { ok, data, error, meta }               │ ← Mint/green border card
└──────────────────────────────────────────┘
```

Use the brand color palette. Dark ink background. Teal connection lines. Rounded corners on all cards.

---

## Image 3: Benchmark Comparison Chart

**Purpose:** Visually striking comparison chart for the "Numbers" section
**Dimensions:** 1400x700px
**Filename:** `benchmark-chart.png`

### Design Spec

Create a grouped horizontal bar chart with three metric groups:

**Active Tokens:**
- agent_direct: 2,851 (muted red/gray bar)
- ghx: 1,075 (teal bar) — label: "-62%"

**Latency (seconds):**
- agent_direct: 57.9s (muted red/gray bar)
- ghx: 5.9s (teal bar) — label: "-90%"

**Tool Calls:**
- agent_direct: 8 (muted red/gray bar)
- ghx: 2 (teal bar) — label: "-75%"

**At the bottom, a full-width green bar:**
- Success Rate: 100% for both — label: "No regression"

Style: Dark background (#0A1220), minimal gridlines, large bold delta percentages, brand fonts (Inter or JetBrains Mono for numbers).

### Generation Prompt (if using AI for stylistic chart)

> A clean, modern bar chart on a dark navy background comparing two systems. Three metric groups arranged vertically: "Active Tokens", "Latency", and "Tool Calls". For each metric, two horizontal bars — one long muted gray bar (the baseline) and one much shorter glowing teal bar (the optimized result). Large percentage labels (-62%, -90%, -75%) next to the teal bars in mint green text. At the bottom, a green success indicator showing "100% reliability". Flat design, technical aesthetic, no decorative elements. The chart should feel like a dashboard from a modern observability tool.

---

## Image 4: Token Tax Concept

**Purpose:** Optional inline image for the opening section
**Dimensions:** 1200x600px
**Filename:** `token-tax-concept.png`

### Generation Prompt

> Minimal illustration on dark background: a conveyor belt with glowing tokens (small hexagonal coins) falling off into a gap in the middle. On one side, an AI robot agent is feeding tokens into the belt. On the other side, only a fraction of the tokens reach a GitHub-style octagonal shield icon. The gap is labeled conceptually as waste. Flat vector style, developer-tool aesthetic, teal and mint color accents against dark navy. No text. Clean lines, geometric shapes.

---

## Image 5: Route Selection Comparison

**Purpose:** Inline image showing chaotic vs. deterministic routing
**Dimensions:** 1200x500px
**Filename:** `route-comparison.png`

### Design Spec (Best as Manual Design)

**Split panel:**

**Left panel — "Agent Guesswork":**
- A central node (agent) with 5-6 outgoing arrows
- Arrows go in different directions, some loop back, some dead-end
- Dashed lines, question marks, red/orange accents
- Multiple endpoints (CLI, GraphQL, REST) reached inconsistently

**Right panel — "ghx Deterministic Routing":**
- Same central node (agent)
- Single clean arrow → Route Planner → preferred route (solid teal line)
- Dotted fallback lines (ready but not active)
- Clean path to result envelope

---

## Image 6: Capability Coverage Map

**Purpose:** Optional diagram showing the breadth of 66 capabilities
**Dimensions:** 1400x800px
**Filename:** `capability-map.png`

### Design Spec

A radial or grid layout showing capability domains:

**Center:** `ghx` logo/mark

**Surrounding domains (as card clusters):**
- **Repository** (3 caps) — top-left
- **Issues** (14 caps) — top-right
- **PR Reads** (8 caps) — right
- **PR Mutations** (12 caps) — bottom-right
- **CI Diagnostics** (5 caps) — bottom
- **Releases** (5 caps) — bottom-left
- **Workflow Control** (10 caps) — left
- **Projects v2** (6 caps) — top

Each domain shows its count and 2-3 example capability names. Connected to center with teal lines.

---

## Image 7: Hero for Article 2 (Benchmark Methodology)

**Purpose:** Featured image for the benchmark methodology article
**Dimensions:** 1400x800px
**Filename:** `hero-benchmark-method.png`

### Generation Prompt

> A technical illustration on a dark navy background showing two parallel test tubes or pipelines side by side, each containing flowing geometric data shapes (hexagons, squares). One pipeline is labeled conceptually as "baseline" (muted gray/silver tones) and the other as "optimized" (teal/mint tones). Between them, a measurement scale or ruler with precise tick marks. At the bottom, both pipelines converge into a validation gate with a green checkmark. The aesthetic should feel like scientific instrumentation meets developer tooling. Flat, geometric, precise. No text, no humans.

---

## Image 8: Result Envelope Concept

**Purpose:** Visual representation of the universal { ok, data, error, meta } envelope
**Dimensions:** 1200x500px
**Filename:** `result-envelope.png`

### Design Spec

A single "package" or envelope shape in the center with four labeled compartments:

```
┌─────────────────────────────────┐
│  📦 Result Envelope             │
│                                 │
│  ┌──────┐  ┌──────┐            │
│  │  ok  │  │ data │            │
│  │  ✅  │  │ { } │            │
│  └──────┘  └──────┘            │
│  ┌──────┐  ┌──────┐            │
│  │error │  │ meta │            │
│  │ null │  │route │            │
│  └──────┘  └──────┘            │
└─────────────────────────────────┘
```

Three arrows feeding into it from the left:
- "CLI Adapter" →
- "GraphQL Adapter" →
- "REST Adapter" →

One arrow out to the right:
- → "Your agent code"

Message: many inputs, one output shape. Use brand colors.

---

## Rendering Priority

For launch, create these in order of impact:

1. **Hero image (Image 1)** — Required. First impression.
2. **Benchmark chart (Image 3)** — Required. Proves the value proposition.
3. **Architecture diagram (Image 2)** — Strongly recommended. Shows technical depth.
4. **Mermaid renders** — Use as fallback if Image 2 is not ready.
5. **Route comparison (Image 5)** — Nice to have. Reinforces the core message.
6. **Everything else** — Polish items for post-launch content refresh.

---

## Tools Recommendation

| Tool | Best For |
|------|----------|
| **Excalidraw** | Architecture diagrams, flow charts, comparison panels |
| **Figma** | Polished charts, branded visuals, social cards |
| **DALL-E 3** | Abstract hero images, concept illustrations |
| **Midjourney** | Stylistic hero images (use `--style raw` for technical aesthetic) |
| **Ideogram** | Images with embedded text (if text in image is needed) |
| **Mermaid Live Editor** | Quick diagram renders from the diagrams.md file |
| **D3.js / Recharts** | Interactive or print-quality benchmark charts |
