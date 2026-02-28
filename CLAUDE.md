# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prism is an AI-native portfolio intelligence system that decomposes ETF/fund holdings into true asset-level exposure, detects macro events, traces causal propagation through a user's specific holdings, and delivers proactive multi-horizon intelligence. Target platform: Wealthsimple.

## Design Philosophy

### Core Principle: AI Drives the Experience

Prism should feel like a knowledgeable friend who understands finance — not a trading terminal with a chatbot bolted on. The AI doesn't sit in a drawer waiting to be opened; it **drives** the user journey.

- **AI narrates every page.** Inline summaries in plain English replace raw data interpretation. Users never stare at a graph wondering what it means.
- **AI pulls users forward.** Proactive insight cards on the Portfolio View surface what matters. Signal cards are stories, not data points.
- **AI guides decisions.** The plan builder is a conversational 3-step wizard ("Here's the situation → Here's what I'd suggest → Review your plan"), not a complex dashboard.
- **AI navigates the app.** Prism is a copilot that can navigate between pages, highlight elements, and apply changes — progressively from "navigate + explain" to "navigate + act."

### UX Principles

- **Wealthsimple simplicity.** Hide complexity, surface clarity. Every screen answers one question clearly.
- **The journey feels like:** "Something happened → here's how it affects you → here's what you can do → you're covered."
- **Tap-first interaction.** Most users won't type. Clickable choice cards (decision cards, quick reply chips, guided flow steps) at every decision point.
- **Plain English always.** Dollar amounts, not percentages. "Could cost you ~$340" not "3.2% downside exposure." Graph nodes get plain-language descriptions.
- **Progressive disclosure.** Start simple (3-node graph summary, 2-3 plan options), expand on demand (full causal chain, candidate grid).
- **"Do nothing" is always an option.** Show the baseline cost of inaction alongside every plan.

### AI Responsibility Boundary

- **AI is responsible for:** decomposing exposure, detecting signals, generating causal chains, narrating impact in plain English, building plan options, scenario modeling (what-if), proactive alerts, cross-scope intent memory.
- **Human decides:** whether to act, which plan to adopt, actual trade execution. Prism presents options with tradeoffs — never a single "right answer."
- **Critical human-only decision: trade execution.** Financial loss is irreversible and regulatory requirements mandate informed consent. Prism must never auto-execute trades.

### Copilot Progression (Levels of AI Agency)

1. **Level 1 — Navigate + Explain:** Smart navigation chips, keep drawer open across pages, context-aware suggestions.
2. **Level 2 — Navigate + Highlight:** Copilot highlights specific graph nodes, holdings rows, or signal cards referenced in conversation.
3. **Level 3 — Navigate + Act:** Copilot applies plan actions, presets, and confirmations via LLM-generated structured output.

## Architecture

Five-layer system: Exposure Engine → Causal Reasoning → Intelligence → Delivery → Interaction.

### Agent Pipeline

| Agent | Role | Uses LLM? |
|-------|------|-----------|
| Exposure Analyzer | Decomposes funds into true asset exposure, detects concentrations | No — pure data |
| Signal Monitor | Queries Gemini with Google Search grounding for live market events relevant to user's exposures | Yes — Gemini + Search grounding |
| Causal Propagation Engine | Multi-hop causal chain generation as structured JSON | Yes — Gemini |
| Temporal Reasoner | Classifies impact as transient/structural/ambiguous | Yes — Gemini |
| Alert Composer | Personalized alert generation with frequency caps | Yes — Gemini |

Shared service: **Personalization Engine** (user context model queried by multiple agents in parallel).

**Orchestrator** coordinates agent execution and routes user what-if scenarios back to the appropriate agent.

### Tech Stack (Prototype — Implemented)

- **Frontend:** React 19 + Vite 6 + D3.js (causal graph visualization)
- **LLM:** Gemini 3.0 flash Preview
- **Agent Framework:** Google ADK TypeScript SDK (`@google/adk`) with `LlmAgent`, `FunctionTool`, and `InMemoryRunner`; domain agents remain modular async functions wrapped as ADK tools
- **Server:** Express.js on port 3001, proxied through Vite dev server
- **Package Manager:** pnpm workspaces (5 packages: frontend, shared, agents, server, data)
- **Data:** Pre-loaded sample portfolios (6 ETFs: VFV, XIC, ZAG, ZEB, XEG, XGD). Top-N fund holdings only (~45-70% coverage), yielding lower concentration percentages than PRD projected.
- **Signal Sources:** Gemini with Google Search grounding (live market signals, not simulated)
- **Causal graphs:** LLM-generated on-the-fly with Zod validation-retry loop (max 2 retries)

### UI Architecture (Progressive Disclosure + AI Narration)

1. **Portfolio View** — home base with always-on X-Ray, concentration warnings, proactive Prism insight card (highest-impact signal), and signal story cards. AI narration summarizes portfolio health in plain English.
2. **Signal Detail View** — master-detail workspace with signal list, causal graph, and impact sidebar. AI narrates above the graph: "This signal could cost you ~$340 this month." What-if questions in chat re-render the graph with alternative causal chains.
3. **Plan View** — conversational 3-step wizard (situation → AI-suggested options → review). Full candidate grid available via "Customize" escape hatch. AI coaching comments after each plan change.
4. **Playbook View** — all active plans with coverage status. AI summarizes: "You have 3 plans covering 2 of 4 risk exposures."
5. **Ask Prism (Copilot Drawer)** — context-aware across all views. Maintains cross-scope intent memory. Presents clickable prompt choices (decision cards, quick replies, guided flows) — typing optional.

Key principles:
- Intelligence pulls users in via signal cards — users never navigate to graphs manually.
- Prism narrates every page with inline summaries — users never interpret raw data alone.
- Every decision point has tap-first options — users never need to know what to ask.

### Causal Chain JSON Structure

Event nodes → Mechanism nodes → Sector/industry nodes → Asset nodes. Each edge has magnitude, confidence score, and temporal classification. Competing effects (positive + negative on same holding) must be preserved and shown.



## Critical Constraints

- **Never auto-execute trades** — present options with tradeoffs, never single "right answers"
- **Never present correlation as causation** — mechanism nodes required between event and impact
- **Causal chains beyond 3 hops** must be flagged as speculative
- **Persistent disclaimer required** on all analysis screens (see PRD Section 9)
- Chat agent must **refuse definitive buy/sell recommendations**
- Max 3 active signal cards on Portfolio View; push notifications capped at 2/day/user
- Exposure calculations must track data freshness and flag stale decompositions
- **Plain English always** — dollar amounts over percentages, everyday language over financial jargon
- **"Do nothing" baseline** must be shown alongside every plan option
- **Confidence ranges** — show "$150–$350" not "$247.32". Precision implies false certainty.
- **Copilot actions require user confirmation** — Level 3 copilot can suggest actions but user must tap to confirm

## Workflow Rules

- **Use `/create-features` for every non-trivial feature requests.** When the user asks to implement a new feature, invoke the `create-features` skill to convert the plan into tracked feature tasks with dependency management before writing any code. This ensures all work is documented, tracked, and aligned with the plan. Make sure to check off the todo list in the .md files under the plan directory as you complete features.

### Documentation Requirements

**Every implementation action must be documented for learning and tracking purposes.** When building features:

1. **Before implementation:** Document the approach, alternatives considered, and why this approach was chosen
2. **During implementation:** Add inline comments explaining non-obvious decisions, especially around causal chain generation, exposure decomposition logic, and agent orchestration
3. **After implementation:** Update this file's architecture section if the implementation diverges from the PRD, and document what was learned

This serves both as a learning record and as context for future sessions.

### Git commit rules
- write logical commit messages after completing each feature

## Demo Flow

1. Portfolio View loads → Prism narrates: "Your portfolio looks mostly healthy, but your 38% Canadian bank exposure could be affected by [live event]. Tap below to see more." → Proactive insight card highlights the highest-impact signal.
2. Tap insight card → Signal Detail with AI narration above graph: "This could cost you ~$340 this month. Your bonds are most exposed." → Causal graph with plain-English node descriptions on hover.
3. Ask Prism: "What if oil prices drop instead?" → Graph re-renders with alternative causal chain (original dimmed, counterfactual highlighted). Prism narrates the difference.
4. Tap "Help me plan" → 3-step wizard: Prism explains the situation, presents 2-3 AI-generated options (do nothing / light protection / balanced response), user selects → plain-English confirmation with "Do nothing" comparison.
5. Plan coaching: "Good start — that reduces your risk by ~$120." User saves to Playbook.
6. Playbook: Prism summarizes coverage across all active plans. Uncovered exposures flagged.

**Key strengths:**
- Signals are live (Gemini + Google Search grounding), not scripted. Different results each day.
- AI drives the entire journey — narrates, suggests, navigates, coaches.
- User never interprets raw data alone. Every screen has a plain-English AI summary.
- Tap-first: clickable choices at every decision point. No typing required.

# GCP account 
- email: nalin19690611@gmail.com
- project: bigquery-etl-488322
