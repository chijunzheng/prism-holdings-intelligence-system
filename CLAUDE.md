# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prism is an AI-native portfolio intelligence system that decomposes ETF/fund holdings into true asset-level exposure, detects macro events, runs multi-agent adversarial analysis to produce calibrated dollar-impact estimates grounded in real market data, and delivers proactive multi-horizon intelligence through a single conversational interface. Target platform: Wealthsimple.

## Design Philosophy

### Core Principle: AI Drives the Experience

Prism should feel like a knowledgeable friend who understands finance — not a trading terminal with a chatbot bolted on. The AI doesn't sit in a drawer waiting to be opened; it **drives** the user journey.

- **AI narrates everything.** Inline summaries in plain English replace raw data interpretation. Users never stare at data wondering what it means.
- **AI pulls users forward.** Proactive signal cards surface what matters. Signals are stories, not data points.
- **AI guides decisions.** Recommendations come with tradeoffs and a "do nothing" baseline — never a single "right answer."
- **AI shows its work.** Every analysis is transparent — the user can see what each agent thought, where they disagreed, and how the numbers were derived.

### UX Principles

- **Wealthsimple simplicity.** Hide complexity, surface clarity.
- **The journey feels like:** "Something happened → here's how it affects you → here's what you can do → you're covered."
- **Single chat interface.** The entire app is one conversation. No separate pages — everything renders as rich cards inside a single chat stream with a persistent context panel.
- **Tap-first interaction.** Most users won't type. Clickable choice cards (decision cards, quick reply chips, checkpoint responses) at every decision point.
- **Plain English always.** Dollar amounts, not percentages. "Could cost you ~$280" not "3.2% downside exposure."
- **Progressive disclosure.** Start with the verdict, expand on demand to see analyst perspectives, debate transcript, computational derivation, and full research brief.
- **"Do nothing" is always an option.** Show the baseline cost of inaction alongside every recommendation.

### AI Responsibility Boundary

- **AI is responsible for:** decomposing exposure, detecting signals, multi-perspective analysis, adversarial debate, calibrated dollar-impact estimation, stress testing, cross-signal synthesis, narrating impact in plain English, building plan options with tradeoffs.
- **Human decides:** whether to act, which plan to adopt, actual trade execution. Prism presents options — never auto-executes.
- **Critical human-only decision: trade execution.** Financial loss is irreversible and regulatory requirements mandate informed consent. Prism must never auto-execute trades.
- **Human-in-the-loop checkpoints.** Humans can inject domain knowledge at key pipeline stages (after debate, after stress test) to correct assumptions before final synthesis.

### Computation-First Principle

LLMs do qualitative reasoning (causal chains, narratives, direction, assumptions). Computation does anything involving numbers (volatility, correlation, dollar impact, stress testing). **No dollar amount should ever come directly from an LLM.**

- Dollar ranges are formula-derived, bounded by computed historical volatility
- Stress scenarios use Monte Carlo simulation with real correlation matrices
- Cross-signal interaction effects are computed from correlations, not LLM-judged
- LLMs contribute qualitative magnitude scores (0–1) and direction — formulas convert these to calibrated dollar ranges

## Architecture

### Multi-Agent Pipeline (Centralized Hierarchical with Adversarial Debate)

The pipeline runs per-signal, with optional cross-signal synthesis for portfolio-level analysis:

| Stage | Team | Pattern | Purpose |
|-------|------|---------|---------|
| 0 | Risk Profile Inference | Pure computation | Infer risk tolerance from portfolio composition |
| 1 | Analyst Team (4 agents) | Parallel fan-out | Independent perspectives: macro, fundamental, sentiment, technical |
| 2 | Researcher Team (Bull vs Bear) | Adversarial debate loop (2-3 rounds) | Challenge and refine analyst consensus through structured debate |
| 3 | Risk Management Team (3 agents) | Sequential devil's advocate | Challenge assumptions, validate magnitudes against historical data, stress test |
| 4 | Fund Manager + Judge | Synthesis with quality loop (max 2 iterations) | Synthesize all inputs into calibrated verdict; judge evaluates quality |
| 5 | Research Brief Generator | Pure template formatting | Format all artifacts into auditable research document (no LLM) |
| — | Cross-Signal Synthesizer | Aggregation + narrative | Portfolio review mode: net vs gross impact, interaction effects across signals |

**Two modes of operation:**
1. **Single-signal mode:** One signal → full pipeline → `FundManagerVerdict` + `ResearchBrief`
2. **Portfolio review mode:** N signals in parallel → N verdicts → Cross-Signal Synthesizer → `PortfolioVerdict` with net vs gross impact and interaction effects

**Key design references:** TradingAgents (bull/bear debate), AlphaAgents (multi-agent debate with risk tolerance), FINCON (manager-analyst hierarchy), Google/MIT Scaling Study (centralized hierarchical outperforms peer-to-peer for financial tasks).

### Human-in-the-Loop Checkpoints

| Checkpoint | When | What the human does |
|------------|------|---------------------|
| Holdings consent | Before any analysis | Grants permission to access portfolio data |
| Expectations submission | Profile setup | Provides risk tolerance, horizon, goals, concerns |
| After debate (Checkpoint 1) | After Bull/Bear debate resolves | Reviews debate outcome, can correct assumptions |
| After stress test (Checkpoint 2) | After Monte Carlo scenarios computed | Selects risk scenario to plan for (base/downside/tail) |
| Decision | After recommendations presented | Selects plan option or customizes |

### Dollar Impact Anchoring (6-Layer)

1. **Portfolio value bounds** — impact cannot exceed holding value (hard ceiling)
2. **Exposure weights** — signal impact constrained to affected exposure slice
3. **Real historical volatility** — computed from Yahoo Finance prices, not LLM-guessed
4. **Multi-analyst qualitative consensus** — LLMs provide direction and magnitude (0–1 scale)
5. **Formula-based calibration** — `holdingValue × magnitude × direction × timeMultiplier`, bounded by computed volatility
6. **Monte Carlo stress testing** — real correlation matrix, VaR/CVaR at 95%/99%

### Tech Stack

- **Frontend:** React 19 + Vite 6 (single chat interface with rich card components)
- **LLM:** Gemini Flash (all agent calls use Gemini with Google Search grounding)
- **Agent Framework:** LangGraph (`@langchain/langgraph`) with typed `StateGraph`, `Send` for parallel fan-out, `interrupt_before` for human-in-the-loop checkpoints, conditional edges for debate loops and quality gates
- **Market Data:** Yahoo Finance API for real volatility, correlation matrices, and historical event impact (cached 24h TTL)
- **Server:** Express.js on port 3001, proxied through Vite dev server
- **Package Manager:** pnpm workspaces (5 packages: frontend, shared, agents, server, data)
- **Data:** Pre-loaded sample portfolios with diversified user profiles
- **Observability:** LangSmith (free tier) for pipeline tracing and debugging

### UI Architecture (Single Chat Interface)

The entire experience flows as a conversation between the user and Prism:

- **Left panel:** Holdings (interactive, tappable), signal sessions, user expectations
- **Main area:** Rich card stream — signals, analyst perspectives, debate summaries, stress scenarios, recommendations, research briefs
- **Sessions:** Each signal analysis is a separate session/thread, accessible from the left panel

Key card types: `SignalCard`, `ThinkingCard` (per-agent reasoning), `DebateSummaryCard`, `CheckpointCard`, `StressScenarioCard`, `RecommendationCard`, `TransparencyCard`, `ResearchBriefCard`, `PortfolioReviewCard`, `HoldingDetailCard`

### What Stays from v1

- Exposure Analyzer (pure data decomposition — feeds ExposureMap to analysts)
- Signal Monitor (Gemini + Search grounding — feeds signals to pipeline)
- Health scoring logic
- Sample portfolio/fund data structure

### What Was Replaced from v1

- Single LLM causal chain generation → multi-agent pipeline with adversarial debate
- Hardcoded dollar estimates → computation-first calibration with real market data
- Google ADK → LangGraph for agent orchestration
- Multi-page UI (Portfolio/Signal/Plan/Playbook views) → single chat interface
- Temporal Reasoner → time horizon logic absorbed into Fund Manager
- Strategy candidate engine → Fund Manager recommendation generation

## Critical Constraints

- **Never auto-execute trades** — present options with tradeoffs, never single "right answers"
- **Never present correlation as causation** — mechanism reasoning required between event and impact
- **No dollar amount from an LLM** — all dollar figures must come from the calibration formula, bounded by computed volatility
- **Persistent disclaimer required** on all analysis screens
- Chat agent must **refuse definitive buy/sell recommendations**
- **Plain English always** — dollar amounts over percentages, everyday language over financial jargon
- **"Do nothing" baseline** must be shown alongside every recommendation
- **Confidence ranges** — show "$150–$350" not "$247.32". Precision implies false certainty.
- **Human checkpoints are non-optional** — pipeline must pause for human input at defined stages
- **`humanDecisionRequired: true`** is a literal type on every verdict — structurally cannot be omitted
- Exposure calculations must track data freshness and flag stale decompositions
- All analyst claims must cite evidence sources (from Gemini Search grounding)
- Debate must resolve or explicitly flag unresolved disagreements — no silent consensus

## Workflow Rules

- **Use `/create-features` for every non-trivial feature requests.** When the user asks to implement a new feature, invoke the `create-features` skill to convert the plan into tracked feature tasks with dependency management before writing any code. This ensures all work is documented, tracked, and aligned with the plan. Make sure to check off the todo list in the .md files under the plan directory as you complete features.

### Documentation Requirements

**Every implementation action must be documented for learning and tracking purposes.** When building features:

1. **Before implementation:** Document the approach, alternatives considered, and why this approach was chosen
2. **During implementation:** Add inline comments explaining non-obvious decisions, especially around multi-agent orchestration, calibration logic, debate protocols, and context management
3. **After implementation:** Update this file's architecture section if the implementation diverges from the plan, and document what was learned

This serves both as a learning record and as context for future sessions.

### Git commit rules
- write logical commit messages after completing each feature

## Demo Flow

1. App opens → single chat interface → Prism greets with portfolio summary and detected signals as rich cards.
2. User taps "Analyze" on a signal → pipeline runs transparently: `ThinkingCards` stream each agent's reasoning in real-time (4 analysts → Bull/Bear debate → risk challenges → stress test → synthesis).
3. **Checkpoint 1:** User reviews debate outcome, can correct assumptions ("I expect 50bps, not 25bps") or continue.
4. **Checkpoint 2:** User sees Monte Carlo stress scenarios with real VaR/CVaR, picks risk level to plan for.
5. `RecommendationCard` presents 2-3 options with "do nothing" baseline. `TransparencyCard` shows full computational derivation. `ResearchBriefCard` provides auditable research document.
6. Portfolio review mode: "You have 3 active risks. Separately they look like -$640. But the oil drop offsets the rate hike. Real net impact: -$180." — gross vs net comparison demonstrates portfolio-level thinking.

**Key strengths:**
- Multi-agent adversarial analysis — not a single LLM guess, but 10+ specialized agents that debate, challenge, and calibrate
- All dollar figures grounded in real market data (Yahoo Finance volatility, correlation, historical event impact)
- Full transparency — user sees every agent's thinking, every assumption challenged, every number's derivation
- Human-in-the-loop — users inject domain knowledge at key stages, not just consume output
- Signals are live (Gemini + Google Search grounding), not scripted

# GCP account
- email: nalin19690611@gmail.com
- project: bigquery-etl-488322
