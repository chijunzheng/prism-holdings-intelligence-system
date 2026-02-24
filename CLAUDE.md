# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prism is an AI-native portfolio intelligence system that decomposes ETF/fund holdings into true asset-level exposure, detects macro events, traces causal propagation through a user's specific holdings, and delivers proactive multi-horizon intelligence. Target platform: Wealthsimple.

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
- **LLM:** Gemini 3.0 Pro Preview (Gemini 2.0 Flash was deprecated for new users)
- **Agent Framework:** TypeScript async functions matching ADK's agent pattern (not Python ADK — see docs/learnings/01 for rationale)
- **Server:** Express.js on port 3001, proxied through Vite dev server
- **Package Manager:** pnpm workspaces (5 packages: frontend, shared, agents, server, data)
- **Data:** Pre-loaded sample portfolios (6 ETFs: VFV, XIC, ZAG, ZEB, XEG, XGD). Top-N fund holdings only (~45-70% coverage), yielding lower concentration percentages than PRD projected.
- **Signal Sources:** Gemini with Google Search grounding (live market signals, not simulated)
- **Causal graphs:** LLM-generated on-the-fly with Zod validation-retry loop (max 2 retries)

### Three UI Views (Progressive Disclosure)

1. **Portfolio View** — home base with always-on X-Ray showing true exposure, concentration warnings, signal cards
2. **Causal Graph View** — entered only via signal card tap; interactive node-edge D3 visualization
3. **Chat Panel** — right-side drawer opened by clicking a graph node; scoped to that node's context

Key principle: Users never navigate to the graph manually — intelligence pulls them in via signal cards.

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

## Workflow Rules

- **Always use `/create-features` for every new feature request.** When the user asks to implement a new feature, invoke the `create-features` skill to convert the plan into tracked feature tasks with dependency management before writing any code.

### Documentation Requirements

**Every implementation action must be documented for learning and tracking purposes.** When building features:

1. **Before implementation:** Document the approach, alternatives considered, and why this approach was chosen
2. **During implementation:** Add inline comments explaining non-obvious decisions, especially around causal chain generation, exposure decomposition logic, and agent orchestration
3. **After implementation:** Update this file's architecture section if the implementation diverges from the PRD, and document what was learned

This serves both as a learning record and as context for future sessions.

### Git commit rules
- write logical commit messages after completing each feature

## Demo Flow

1. Portfolio View loads → X-Ray reveals multiple hidden concentrations: 38% Canadian financials, 21% US tech, 16% energy — user thought 6 ETFs = diversified
2. Signal Monitor queries Gemini with Google Search grounding for live events relevant to user's top exposures → signal card appears with real, current market event
3. Tap card → Gemini generates causal propagation chain on-the-fly from live event → graph renders with competing effects
4. Click node → Chat Panel with pre-loaded context
5. Toggle counterfactual → graph re-renders with reduced impact

**Key strength:** Signals are live, not scripted. Demo produces different results each day based on actual market events. All signals include source citations from grounded search.

# GCP account 
- email: nalin19690611@gmail.com
- project: bigquery-etl-488322
