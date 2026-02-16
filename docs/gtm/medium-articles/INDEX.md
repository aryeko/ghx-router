# Medium Articles — Index and Publishing Guide

## Article Inventory

### Article 1 (Primary): "Stop Paying the Token Tax on GitHub Agent Workflows"

- **File:** [article-01-stop-paying-token-tax.md](./article-01-stop-paying-token-tax.md)
- **Type:** Deep technical narrative — flagship launch article
- **Length:** ~2,500 words (~12 min read)
- **Publish first:** Yes — this is the anchor content
- **Angle:** Problem-solution narrative. Opens with the pain of agent discovery loops, walks through the architecture, shows benchmark evidence, ends with 60-second quickstart.
- **Key sections:**
  1. The Hidden Cost of "Just Use gh" (hook + problem)
  2. Five failure modes of ad-hoc agent GitHub automation
  3. The Architecture Fix: Capabilities Over Commands
  4. How It Works Under the Hood (pipeline walkthrough)
  5. 66 Capabilities Across the Full GitHub Workflow
  6. The Numbers: Benchmarked, Not Promised
  7. A Real Workflow: PR Diagnosis to Merge
  8. Getting Started in 60 Seconds
  9. Tradeoffs and Honest Limits
- **Why this works:** Combines narrative engagement with technical depth. Readers who skim get the numbers. Readers who read deeply get architecture understanding. Both get a copy-paste quickstart.

### Article 2 (Secondary): "How We Benchmark Agent Developer Tools"

- **File:** [article-02-benchmarking-agent-tools.md](./article-02-benchmarking-agent-tools.md)
- **Type:** Methodology deep-dive — thought leadership
- **Length:** ~1,600 words (~8 min read)
- **Publish:** 3-5 days after Article 1
- **Angle:** "Most agent tool benchmarks are untrustworthy. Here's how to do it right." Positions ghx as a rigorous engineering team, not a hype machine. Provides transferable knowledge readers can apply to any tool.
- **Key sections:**
  1. The Problem with Agent Tool Benchmarks
  2. The Benchmark Design (modes, fixtures, validation)
  3. What We Measure (efficiency + reliability metrics)
  4. The Gate System (dual profiles)
  5. Current Results
  6. How to Apply This to Your Own Tools
- **Why this works:** Establishes credibility. Readers who evaluate agent tools get a framework. The ghx results appear as evidence of the methodology, not the other way around.

---

## Supporting Assets

### Diagrams

- **File:** [diagrams.md](./diagrams.md)
- **Contents:** 6 Mermaid diagrams with rendering instructions
- **Key diagrams:**
  1. Ad-hoc failure loop (the problem)
  2. ghx architecture flow (the solution)
  3. Routing decision tree (technical depth)
  4. Benchmark comparison chart
  5. PR workflow pipeline (practical example)
  6. Adoption funnel

### Image Generation Guide

- **File:** [image-generation-guide.md](./image-generation-guide.md)
- **Contents:** 8 image specifications with AI generation prompts and manual design specs
- **Priority order for creation:**
  1. Hero image (featured/cover image)
  2. Benchmark comparison chart
  3. Architecture diagram (polished version)
  4. Route comparison (before/after)
  5. Remaining images as time permits

---

## Publishing Strategy

### Timing

| Action | When | Channel |
|--------|------|---------|
| Article 1 published | Launch day | Medium |
| LinkedIn post (Article 1 promo) | Launch day + 2 hours | LinkedIn |
| X launch thread | Launch day + 4 hours | X/Twitter |
| Article 2 published | Launch day + 3-5 days | Medium |
| LinkedIn post (Article 2 promo) | Article 2 day + 2 hours | LinkedIn |

### Medium-Specific Tips

1. **Featured image:** Use Image 1 (hero) at 1400x800px minimum
2. **Subtitle:** Use the provided subtitle line for SEO
3. **Tags:** Use all 5 allowed tags from the suggested list
4. **Code blocks:** Medium supports ``` syntax — paste code directly
5. **Images in body:** Upload rendered diagrams as inline images
6. **Mermaid diagrams:** Must be rendered to PNG first (Medium does not render Mermaid natively)
7. **Friend link:** Generate an unlocked link for sharing on LinkedIn and X
8. **Publication:** Consider submitting to these Medium publications for reach:
   - **Better Programming** (large dev audience)
   - **Towards AI** (AI-focused readers)
   - **Level Up Coding** (practical developer content)
   - **ITNEXT** (infrastructure and tooling)
   - **The Startup** (broad tech audience)

### SEO / Discoverability

**Primary keywords:**
- AI agent GitHub automation
- GitHub CLI tool for agents
- agent developer tools
- typed capability router
- GitHub execution router

**Title variants to A/B test:**
- "Stop Paying the Token Tax on GitHub Agent Workflows" (primary)
- "Your AI Agent Re-Learns GitHub Every Run. Here's the Fix."
- "62% Fewer Tokens: How Typed Capabilities Replace Ad-Hoc GitHub Automation"

### Cross-Promotion Checklist

- [ ] Add Medium article link to ghx README
- [ ] Pin article link in GitHub Discussions (if enabled)
- [ ] Include article link in integration PR descriptions
- [ ] Share in relevant Discord/Slack communities (AI agents, dev tools)
- [ ] Post in r/MachineLearning, r/LocalLLaMA, r/programming weekly threads
- [ ] Submit to Hacker News (title: "Show HN: ghx – Typed GitHub capability router for AI agents")

---

## Content Quality Checklist

Before publishing, verify:

- [ ] All benchmark numbers match `latest-summary.json` exactly
- [ ] Model ID (`gpt-5.1-codex-mini`) is attributed with every numeric claim
- [ ] CTA commands (`npx @ghx-dev/core capabilities list` and `run repo.view`) are tested and working
- [ ] All code blocks are syntactically correct
- [ ] Diagrams are rendered and embedded as images
- [ ] Featured image meets Medium's recommended dimensions
- [ ] No broken links
- [ ] Read time estimate is accurate
- [ ] Author bio link points to correct GitHub profile
- [ ] Tags are selected and applied
