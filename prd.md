# Product Requirements Document: Prism

## AI-Native Multi-Horizon Portfolio Intelligence System

**Author:** Jason
**Version:** 1.5
**Date:** February 2026
**Status:** Prototype / Wealthsimple AI Builder Application

---

## 1. Executive Summary

Prism is an AI-native system that transforms passive portfolio holding into active portfolio awareness. It continuously monitors a user's true asset-level exposure — seeing through ETFs, index funds, and overlapping holdings — detects incoming macro and market events, traces their causal propagation through the user's specific holdings, and delivers proactive, personalized, multi-horizon intelligence before the user ever thinks to ask.

**The core thesis:** Retail investors think they're diversified. They're not. They own 6 ETFs and believe they're spread across sectors, but 43% of their real dollar exposure is concentrated in 3 Canadian banks. When a macro event hits, they don't understand *why* their "diversified" portfolio dropped — because no tool has ever shown them the hidden wiring underneath their holdings.

This system makes that wiring visible, watchable, and actionable.

---

## 2. Problem Statement

### The Legacy Reality

Today's retail investor experience operates on a single time horizon with no causal awareness:

- **Robo-advisors** say "stay the course" regardless of what's happening in the world. They optimize allocation at onboarding time and rebalance on schedule — with no event-driven intelligence.
- **Trading apps** show price changes after the fact. A user sees red and green numbers with no explanation of *why* or *what's connected to what*.
- **News feeds** deliver generic market commentary unconnected to the user's specific holdings. A headline about Bank of Canada policy is the same whether you have 5% or 50% bank exposure.
- **Research tools** help users find new stocks to buy. Nobody helps users understand what they already own at a causal level.

### The Gap

No system available to retail investors connects these three things simultaneously:

1. **True exposure** — what do I actually own, underneath the fund wrappers?
2. **Causal awareness** — what real-world events affect my specific holdings, and how does impact propagate?
3. **Temporal reasoning** — is this a short-term blip I should ignore (or exploit), or a structural shift I need to act on?

Bloomberg terminals do some of this for institutional investors at $25K/year. Retail investors get none of it.

### What This Changes

A Wealthsimple user with Prism doesn't wake up to unexplained red numbers. They wake up to:

> "Your portfolio has a hidden 43% concentration in Canadian financials across 4 holdings. Yesterday's BoC policy minutes signal tighter mortgage lending rules. Here's how that propagates to your specific holdings — and why the short-term and long-term implications point in different directions."

The user taps in, sees the causal graph, clicks any node to drill into the reasoning, and decides what to do — armed with the same quality of insight a portfolio manager at an institutional fund would have.

---

## 3. System Overview

### 3.1 Architecture Layers

The system operates as five interconnected layers:

```
┌─────────────────────────────────────────────────────────────────┐
│              LAYER 5: INTERACTION                                │
│                                                                  │
│   Portfolio View          Causal Graph View      Chat Panel      │
│   (home base,             (event-driven,         (right-side     │
│    always-on X-ray,        appears when           drawer,        │
│    signal cards)           signal fires)          node-scoped)   │
│                                                                  │
│   [Portfolio View] ──signal card tap──→ [Causal Graph View]      │
│                                          ──node click──→ [Chat]  │
├─────────────────────────────────────────────────────────────────┤
│              LAYER 4: DELIVERY                                   │
│   Proactive Alerts (push + in-app signal cards)                  │
│   Weekly Digests · Notification Management                       │
├─────────────────────────────────────────────────────────────────┤
│              LAYER 3: INTELLIGENCE                                │
│   Multi-Horizon Analysis → Temporal Classification               │
│   (Transient/Structural/Ambiguous)                               │
│   Personalized Recommendations · Counterfactual Analysis         │
├─────────────────────────────────────────────────────────────────┤
│              LAYER 2: CAUSAL REASONING                            │
│   Event Ingestion → Causal Graph Construction →                  │
│   Multi-Hop Propagation → Portfolio Impact Mapping               │
├─────────────────────────────────────────────────────────────────┤
│              LAYER 1: EXPOSURE ENGINE                             │
│   Holdings Ingestion → ETF/Fund Decomposition →                  │
│   True Asset-Level Exposure Map → Concentration Detection        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 User Interface Architecture

The UI has three distinct views connected by a progressive disclosure flow:

```
┌─────────────────────┐     signal card      ┌─────────────────────┐
│   PORTFOLIO VIEW     │ ──── tap ─────────→  │  CAUSAL GRAPH VIEW  │
│   (home base)        │                      │  (event-driven)     │
│                      │                      │                     │
│  • Account summary   │                      │  • Full interactive │
│  • Holdings list     │                      │    node-edge graph  │
│  • Exposure X-Ray    │                      │  • Time slider      │
│    (always visible)  │                      │  • Counterfactual   │
│  • Concentration     │                      │    toggle           │
│    warnings          │  ◄── back ────────── │                     │
│  • Active signal     │                      │                     │
│    cards             │                      │                     │
└─────────────────────┘                      └────────┬────────────┘
                                                      │ node click
                                                      ▼
                                             ┌─────────────────────┐
                                             │  CHAT PANEL         │
                                             │  (right-side drawer)│
                                             │                     │
                                             │  • Scoped to        │
                                             │    selected node    │
                                             │  • Pre-loaded       │
                                             │    context          │
                                             │  • Why / What-if /  │
                                             │    What should I do │
                                             └─────────────────────┘
```

**Key design principle:** The user never navigates to the causal graph manually. They arrive there because the system detected something and surfaced it as a signal card on the Portfolio View. Intelligence pulls the user in — the user doesn't go looking for it.

### 3.3 Agent Architecture

The system is composed of five specialized agents coordinated through an orchestrator, supported by a shared context layer.

#### Agents

| Agent | Responsibility | Input | Output |
|-------|---------------|-------|--------|
| **Exposure Analyzer** | Decomposes holdings into true asset-level exposure, detects hidden concentrations | Raw portfolio holdings, fund composition data, user account types (via Personalization Engine) | Weighted exposure map, concentration alerts |
| **Signal Monitor** | Ingests real market/macro events via Gemini with Google Search grounding and classifies relevance to user's exposure | User's top exposure concentrations (from Exposure Analyzer) | Classified signal events with relevance scores and source citations |
| **Causal Propagation Engine** | Traces multi-hop impact paths from events through sectors to specific holdings | Signal events, exposure map | Impact propagation chains with magnitude estimates (structured JSON) |
| **Temporal Reasoner** | Classifies each impact as transient, structural, or ambiguous; generates multi-horizon recommendations | Propagation chains, historical patterns, exposure map, user context (via Personalization Engine) | Time-bucketed analysis with competing recommendations |
| **Alert Composer** | Formats and delivers alerts; manages notification thresholds and frequency caps | Temporal analysis, user preferences (via Personalization Engine) | Personalized proactive alerts, chat-ready context |

#### Shared Context Layer

| Service | Responsibility | Consumed By |
|---------|---------------|-------------|
| **Personalization Engine** | Maintains the user context model (age, risk tolerance, goals, account types, life events, interaction history). Not a pipeline agent — a shared data service queried by multiple agents in parallel to calibrate their outputs to the specific user. | Exposure Analyzer (account types), Temporal Reasoner (urgency calibration, recommendation framing), Alert Composer (materiality thresholds, notification preferences), Chat Agent (response personalization) |

#### Orchestrator

Coordinates agent execution, routes user interactions from the Graph UI and Chat Agent back to the appropriate pipeline agent for re-evaluation (e.g., user "what-if" scenarios trigger a re-run of the Causal Propagation Engine with modified assumptions).

---

## 4. Detailed Feature Requirements

### 4.1 Exposure Decomposition Engine

**Purpose:** Transform a list of holdings into the user's TRUE asset-level exposure by looking through fund wrappers.

#### Functional Requirements

- **FR-1.1:** Ingest user's portfolio holdings across all account types (TFSA, RRSP, FHSA, non-registered, etc.)
- **FR-1.2:** For each ETF or mutual fund holding, decompose into underlying constituent assets using fund composition data
- **FR-1.3:** Calculate dollar-weighted exposure to each underlying asset across ALL holdings (e.g., "You hold Apple through VFV, QQQ, and XIC — total Apple exposure is 7.2% of portfolio")
- **FR-1.4:** Aggregate exposures by sector, geography, asset class, and factor (growth/value/momentum)
- **FR-1.5:** Detect concentration risk — flag when any single asset, sector, or geography exceeds configurable thresholds relative to user's target allocation
- **FR-1.6:** Detect overlap — flag when multiple holdings provide redundant exposure to the same underlying assets
- **FR-1.7:** Generate an exposure delta report showing how the user's TRUE exposure differs from what a naive reading of their holdings would suggest

#### Data Sources

- Portfolio holdings from Wealthsimple accounts (primary)
- ETF composition data (e.g., from fund providers' daily holdings reports)
- Mutual fund top holdings (quarterly, with staleness tracking)
- Index composition data for index-tracking funds

#### Edge Cases & Constraints

- Fund composition data is reported with varying staleness (daily for major ETFs, quarterly for mutual funds). System must track data freshness and flag when decomposition may be unreliable.
- International funds may have incomplete composition data. System must handle partial decomposition and communicate uncertainty.
- Leveraged/inverse ETFs require adjusted weighting calculations.
- Options positions (once Wealthsimple ships advanced options) require delta-adjusted exposure calculation.

---

### 4.2 Signal Monitoring & Ingestion

**Purpose:** Ingest real macro, market, and company-level events and assess their potential relevance to the user's portfolio.

#### Implementation: Gemini with Google Search Grounding

The Signal Monitor agent uses Gemini with Google Search grounding to pull real, current market data. This means the system operates on live market signals — not canned, pre-scripted events — in both the prototype and production.

The agent is prompted with the user's top exposure concentrations (from the Exposure Analyzer) and asks Gemini to search for recent events relevant to those specific sectors and holdings. Gemini returns grounded, cited results from real news sources, central bank publications, earnings reports, and economic data releases.

This approach eliminates the need for custom news API integrations in the prototype while providing real, current, citable signal data.

#### Signal Categories

- Central bank communications (BoC, Fed — rate decisions, policy minutes, speeches)
- Economic data releases (CPI, employment, GDP, housing data)
- Earnings reports and guidance changes for holdings in user portfolios
- Regulatory and policy announcements affecting relevant sectors
- Significant sector/industry news

#### Functional Requirements

- **FR-2.1:** Signal Monitor queries Gemini with Google Search grounding, scoped to the user's top exposure concentrations, to retrieve recent relevant events
- **FR-2.2:** For each incoming signal, classify:
  - **Relevance** — does this signal connect to any asset, sector, or factor present in the user's true exposure map?
  - **Magnitude** — how significant is this signal historically? (e.g., a 25bps rate hike vs. an emergency 100bps cut)
  - **Novelty** — is this expected (priced in) or surprising?
- **FR-2.3:** Filter signals below a configurable relevance + magnitude threshold to prevent noise
- **FR-2.4:** Deduplicate signals from multiple sources reporting the same event
- **FR-2.5:** All signals must include source citations from the grounded search results

#### Constraints

- System must distinguish between rumor/speculation and confirmed events
- Source credibility weighting: official sources (central banks, regulatory bodies, company filings) > major news outlets > aggregators > social media
- Gemini search grounding provides results from the live web — the system inherits whatever is currently published, which may include errors or retractions. The Causal Propagation Engine should weight signals from higher-credibility sources more heavily.

---

### 4.3 Causal Graph & Propagation Engine

**Purpose:** Generate multi-hop causal impact paths from macro events through sectors to the user's specific portfolio holdings. For the prototype, chains are generated on-the-fly by Gemini; for production, they would be persisted and accumulated over time.

#### Functional Requirements

- **FR-3.1:** Generate a directed causal chain as structured JSON with:
  - **Event nodes** — macro events, policy changes, earnings surprises
  - **Mechanism nodes** — economic transmission mechanisms (e.g., "higher rates → higher mortgage costs → reduced housing demand")
  - **Sector/industry nodes** — affected sectors with directional impact
  - **Asset nodes** — individual securities and their sensitivity to sector impacts
- **FR-3.2:** For each incoming signal, trace propagation paths through the graph:
  - First-order effects (direct impact)
  - Second-order effects (downstream consequences)
  - Third-order effects (where supported by strong causal evidence)
  - Stop propagation when confidence drops below threshold
- **FR-3.3:** Handle COMPETING EFFECTS within the same causal chain:
  - Example: Rate hike → bank net interest margins IMPROVE (positive) BUT loan loss provisions INCREASE (negative). Both effects propagate to the same bank holdings.
  - System must present both paths and their net estimated impact
- **FR-3.4:** Map propagation terminal nodes to the user's true exposure map to calculate portfolio-level dollar impact estimates
- **FR-3.5:** Assign confidence scores to each edge in the propagation chain
- **FR-3.6:** Support user-initiated "what-if" propagation: user hypothesizes an event, system traces the causal chain

#### Causal Graph Construction

**Prototype:** The Causal Propagation Engine generates causal chains on-the-fly using Gemini. When a signal arrives, the engine prompts Gemini with the event context + the user's exposure map. Gemini outputs a structured JSON response describing the full causal chain (event → mechanism → sector → holding nodes with edges, magnitudes, and confidence scores). The frontend renders this JSON as the interactive visual graph. No pre-seeded graph database is required.

**Production:** Generated causal chains are persisted to a graph database, building accumulated knowledge over time. When a new event arrives that relates to an existing chain, the system retrieves and updates the previous chain rather than regenerating from scratch. Historical validation can be applied retroactively — comparing predicted propagation paths against actual market outcomes to refine future generation.

#### Constraints

- Causal chains beyond 3 hops carry high uncertainty and must be flagged as speculative
- The graph must NEVER present correlation as causation — mechanism nodes are required between event and impact nodes
- During high-volatility regimes, historical correlations break down. System must flag when it's operating in a regime where its causal model may be unreliable
- Graph updates must be auditable — every edge addition/modification must have a reasoning trace

---

### 4.4 Temporal Risk Decomposition

**Purpose:** Classify every detected risk into its time horizon and generate recommendations that acknowledge when short-term and long-term implications conflict.

#### Functional Requirements

- **FR-4.1:** For each propagation chain that reaches the user's portfolio, classify the impact as:
  - **Transient** — short-term event risk expected to mean-revert within days to weeks. Historical precedent shows recovery. Response: sit tight, or exploit as tactical opportunity.
  - **Structural** — fundamental shift in the investment thesis for affected holdings. Unlikely to revert. Response: consider rebalancing.
  - **Ambiguous** — could be either. Insufficient evidence to classify with confidence. Response: present BOTH interpretations, make the user decide.
- **FR-4.2:** Generate time-bucketed impact estimates:
  - 1-week expected impact (with confidence interval)
  - 1-month expected impact
  - 6-month expected impact
- **FR-4.3:** When short-term and long-term recommendations conflict, EXPLICITLY surface the tension:
  - Example: "Short-term: this is likely a buying opportunity in REITs. Long-term: this may signal structural weakness in Canadian real estate. These recommendations are in tension. Here's what each assumes."
- **FR-4.4:** Generate specific, actionable rebalancing suggestions that address the identified risk — not generic advice, but concrete trades with dollar amounts based on the user's actual holdings
- **FR-4.5:** Show counterfactual analysis: "If you had rebalanced 3 months ago, your exposure to this event would be $X instead of $Y"

#### Classification Methodology

Temporal classification uses:

1. **Historical base rate** — how often have similar events been transient vs. structural?
2. **Signal clustering** — is this an isolated event or part of a pattern? (e.g., one supply chain disruption = likely transient; third disruption in 8 months = possibly structural)
3. **Structural indicators** — does this event change fundamental industry economics, regulatory environment, or competitive dynamics?
4. **LLM reasoning** — synthesize the above with contextual analysis of the specific event

---

### 4.5 Personalization Engine

**Purpose:** Ensure every alert, recommendation, and visualization is calibrated to the specific user's financial context.

#### User Context Model

| Attribute | Impact on System Behavior |
|-----------|--------------------------|
| Age / years to retirement | Adjusts urgency weighting — structural risks matter more with shorter horizons |
| Risk tolerance (stated + revealed) | Calibrates alert thresholds and recommendation aggressiveness |
| Account types | Determines tax implications of recommended rebalancing (TFSA vs. non-registered) |
| Income / contribution room | Affects whether "buy the dip" recommendations are feasible |
| Financial goals (stated) | Contextualizes recommendations ("you're saving for a house in 2 years, so...") |
| Life events (detected or declared) | Triggers contextual re-evaluation of all active risk assessments |
| Interaction history | Learns which alert types the user engages with vs. dismisses |

#### Functional Requirements

- **FR-5.1:** All recommendations must reference user context explicitly in the reasoning: "Because you're 7 years from retirement, this structural risk to your 43% bank concentration is more urgent than it would be for a younger investor"
- **FR-5.2:** Alert materiality thresholds are personalized — a 2% portfolio impact might be worth alerting a retiree but not a 25-year-old
- **FR-5.3:** Recommendation tone and complexity adapts to user's demonstrated financial literacy (inferred from interaction patterns)
- **FR-5.4:** System must never give the same recommendation to two users with different contexts, even if they hold identical portfolios

---

### 4.6 Portfolio View — Always-On X-Ray

**Purpose:** The system's home base. Embeds passive intelligence directly into the portfolio holdings page — no button click, no separate tool. The user sees their true exposure the moment the page loads.

#### Layout

```
┌──────────────────────────────────────────────────┐
│  TFSA ▾                                  🇨🇦 🇺🇸   │
│  $30,965.33 CAD                                  │
│  +$266.82 past day →                             │
│  [performance chart]                             │
│                                                  │
│  Holdings                      More details →    │
│  ├ VFV    $12,400                                │
│  ├ XIC    $8,200                                 │
│  ├ ZAG    $5,100                                 │
│  └ ...                                           │
│                                                  │
│ ──────────────────────────────────────────────── │
│                                                  │
│  ⚡ Portfolio X-Ray                               │
│                                                  │
│  ⚠️ Hidden concentration detected                 │
│  43% of your true exposure is Canadian           │
│  financials across 4 holdings                    │
│                                                  │
│  [Exposure breakdown bars]                       │
│  ██████████████████░░░░ Financials 43%           │
│  ████████░░░░░░░░░░░░░ Tech 22%                 │
│  ████░░░░░░░░░░░░░░░░░ Energy 11%               │
│  ███░░░░░░░░░░░░░░░░░░ Bonds 9%                 │
│  ██░░░░░░░░░░░░░░░░░░░ Other 15%                │
│                                                  │
│  Overlapping holdings:                           │
│  "Apple appears in VFV + XQQ — 7.2% total"      │
│                                                  │
│ ──────────────────────────────────────────────── │
│                                                  │
│  🟡 Active Signals                                │
│  ┌──────────────────────────────────────────┐    │
│  │ BoC policy minutes signal tighter        │    │
│  │ mortgage rules → impacts your 43%        │    │
│  │ Canadian financials exposure              │    │
│  │ ⏱ Structural risk · High materiality     │    │
│  │                     View analysis →      │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Monitoring 14 signal categories relevant        │
│  to your top exposures                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Functional Requirements

- **FR-6.1:** X-Ray section renders automatically on page load — no user action required. The Exposure Analyzer runs on every portfolio change (new holdings, rebalancing, deposits) and caches the result.
- **FR-6.2:** Display the user's TRUE sector/geography/factor exposure breakdown as horizontal bars, calculated by looking through all ETFs and funds to underlying assets.
- **FR-6.3:** Concentration warnings appear inline when any sector, geography, or single asset exceeds configurable thresholds. Warning severity scales with concentration level and user context (higher urgency for users closer to retirement).
- **FR-6.4:** Overlapping holdings section identifies when the same underlying asset appears in multiple funds, with the combined percentage.
- **FR-6.5:** Monitoring status line shows the user the system is actively watching — "Monitoring N signal categories relevant to your top exposures." This sets the expectation that the system is alive even when no signals are active.

#### First-Time Experience

On the user's very first visit, the X-Ray is the introduction to the system:

1. Exposure Analyzer runs against the user's holdings
2. X-Ray renders with the exposure breakdown and any concentration warnings
3. If concentrations are detected, the system highlights them as the primary insight: "You hold 6 ETFs across 3 accounts. Here's what you actually own underneath."
4. Below the X-Ray: "I'm now monitoring for events that could affect your concentrated exposures. I'll alert you when something material happens."
5. No signal cards on first visit (unless an active event coincidentally exists)

The first-time reveal — showing the user their hidden concentrations — is the hook that establishes the system's value before any event has fired.

---

### 4.7 Signal Cards & Proactive Alerts

**Purpose:** Surface actionable intelligence on the Portfolio View when material events affect the user's holdings. Signal cards are the bridge between passive awareness (X-Ray) and active analysis (Causal Graph).

#### Signal Card Design

Each signal card appears in the "Active Signals" section of the Portfolio View and contains:

- **Headline** — one-sentence plain-language summary of the event and its relevance to the user's portfolio
- **Impact tag** — temporal classification (Transient / Structural / Ambiguous) with color coding
- **Materiality indicator** — High / Medium based on personalized threshold
- **Call-to-action** — "View analysis →" which navigates to the full Causal Graph View for this event

Signal cards animate in when a new signal fires, drawing the user's attention without being disruptive.

#### Functional Requirements

- **FR-7.1:** Signal cards appear on the Portfolio View when the Alert Composer determines a signal exceeds the user's personalized materiality threshold
- **FR-7.2:** Maximum 3 active signal cards displayed on the Portfolio View at any time. If more signals are active, show the top 3 by materiality with a "View all (N) →" link
- **FR-7.3:** Signal cards persist until the user either views the analysis or the signal is no longer material (e.g., event has been fully priced in)
- **FR-7.4:** Tapping a signal card navigates to the Causal Graph View, pre-loaded with the full propagation chain for that specific event
- **FR-7.5:** Push notifications (outside the app) also deliver alerts for high-materiality signals, linking directly to the Causal Graph View when tapped

#### Push Notification Requirements

- **FR-7.6:** Push notification contains: one-line summary + temporal classification badge. Tapping opens the app directly to the Causal Graph View for that signal.
- **FR-7.7:** Push frequency capped per user per day (configurable, default: max 2). If multiple signals fire, prioritize by materiality and combine where causal chains overlap.
- **FR-7.8:** "Quiet mode" respects user preferences — no push notifications outside market hours unless the user opts in.
- **FR-7.9:** Weekly digest option for users who prefer batch updates: summarize all causal activity affecting their portfolio over the past week, ranked by materiality.

#### Anti-Spam Safeguards

- Alerts must pass a "would a reasonable financial advisor call you about this?" test
- Consecutive alerts on the same causal chain are suppressed unless the magnitude has changed materially
- System tracks alert engagement rate per user and reduces frequency for users who consistently dismiss alerts

---

### 4.8 Causal Graph View — Event-Driven Analysis

**Purpose:** Full-screen interactive visualization of how a specific event propagates through the user's portfolio. This is NOT a page the user navigates to manually — they arrive here by tapping a signal card or push notification.

#### Entry Points

- Tap a signal card on the Portfolio View
- Tap a push notification
- Tap a link in a weekly digest email
- (No direct navigation — the graph is always event-scoped)

#### Functional Requirements

- **FR-8.1:** Render the causal propagation graph as an interactive node-edge visualization:
  - **Event nodes** (left) — what happened in the world
  - **Mechanism nodes** (center) — how the effect transmits
  - **Holding nodes** (right) — the user's specific affected holdings with dollar impact
- **FR-8.2:** Encode visual information on edges:
  - **Thickness** — magnitude of the effect
  - **Color** — direction (green = positive impact, red = negative, yellow = ambiguous/competing)
  - **Opacity** — confidence level (faded = lower confidence)
- **FR-8.3:** Encode temporal classification on nodes:
  - Visual indicator distinguishing transient / structural / ambiguous impacts
  - Competing effects on the same node are visually distinguished (split color, or stacked indicators)
- **FR-8.4:** Interactive behaviors:
  - **Click any node** → opens contextual Chat Panel as a right-side drawer, scoped to that node
  - **Hover** → shows tooltip with key metrics (dollar impact, confidence, time horizon)
  - **Expand/collapse** → show or hide second/third-order effects to manage visual complexity
  - **Toggle counterfactual** → re-render graph showing "what if I had already rebalanced?"
  - **Time slider** → shift the view between 1-week, 1-month, and 6-month impact projections
- **FR-8.5:** Graph must remain readable with up to 15-20 nodes. Beyond that, cluster lower-magnitude paths and allow expansion on demand.
- **FR-8.6:** Back navigation returns to the Portfolio View. The signal card updates to show "Viewed" state.
- **FR-8.7:** If multiple active signals exist, a signal switcher at the top of the Causal Graph View allows navigating between events without returning to the Portfolio View.

#### Design Principles

- **Information density over decoration** — every visual element must encode data
- **Progressive disclosure** — start simple (event → your portfolio impact), allow drilling into mechanism chains on demand
- **Legibility over impressiveness** — the graph is a reasoning tool, not a screensaver

---

### 4.9 Contextual Chat Panel — Right-Side Drawer

**Purpose:** Allow the user to interrogate the system's reasoning through natural language, scoped to the specific node or chain they selected in the Causal Graph View.

#### Interaction Model

The Chat Panel is NOT a standalone chatbot. It is a right-side drawer that slides in when the user clicks a node on the Causal Graph View. The graph remains visible on the left side of the screen while the chat occupies the right. This side-by-side layout allows the user to reference the visual graph while conversing with the AI.

#### Functional Requirements

- **FR-9.1:** Chat opens pre-loaded with context from the selected graph node — the user does not need to re-explain what they're asking about. The first message from the system summarizes the selected node's role in the propagation chain.
- **FR-9.2:** Chat agent has access to:
  - The full causal propagation chain for the selected event
  - The user's true exposure map
  - The user's full profile context (age, goals, risk tolerance, account types)
  - The temporal classification and reasoning behind it
  - Source citations for every claim in the causal chain
- **FR-9.3:** Supported interaction patterns:
  - **"Why?"** — explain the causal reasoning behind any link in the chain
  - **"What if?"** — user provides alternative assumptions, system recalculates ("What if I think banks will be fine?"). The Causal Graph View re-renders to reflect the modified assumptions.
  - **"What should I do?"** — system generates specific rebalancing options with tradeoffs
  - **"Show me the other side"** — system presents the contrarian case against its own analysis
  - **"How confident are you?"** — system explains confidence levels and what would change them
- **FR-9.4:** Chat must cite sources for factual claims (earnings data, policy announcements, economic indicators)
- **FR-9.5:** Chat must REFUSE to give a definitive buy/sell recommendation — it presents options with tradeoffs and makes the user choose
- **FR-9.6:** When the user clicks a different node on the graph, the chat panel resets and re-scopes to the newly selected node, with a clear visual transition

---

## 5. The Human Decision Boundary

### What the AI is Responsible For

- Decomposing holdings to reveal true exposure
- Detecting and classifying incoming signals
- Tracing causal propagation with cited reasoning
- Classifying temporal impact (transient / structural / ambiguous)
- Generating specific, personalized rebalancing options
- Proactively alerting users when material events affect their portfolio
- Presenting competing recommendations honestly when time horizons conflict

### What Must Remain Human

**The critical decision that must remain human: whether to act on any recommendation — and in what direction.**

This is non-negotiable for three reasons:

1. **Subjective risk tolerance is not fully modelable.** A user's stated risk tolerance and their actual emotional capacity for loss diverge under stress. Only the human knows their true threshold in the moment.

2. **Outside context is invisible to the system.** The user may be about to buy a house, go through a divorce, change jobs, receive an inheritance, or face a medical expense. Any of these radically changes the right portfolio action. The system can ask about life events but cannot detect all of them.

3. **Temporal ambiguity requires a belief about the future.** When the system classifies an impact as "ambiguous — could be transient or structural," the user's decision depends on their personal read of the situation. Two equally rational investors might make opposite choices. The system's job is to make the tradeoffs explicit, not to choose.

### Where the AI Must Explicitly Stop

- The system NEVER auto-executes trades
- The system NEVER presents a single recommendation as "the right answer" — always options with tradeoffs
- The system NEVER hides uncertainty — if confidence is low, it says so
- The system NEVER suppresses the contrarian case — every recommendation includes what would make it wrong
- The system flags when it's operating outside its reliable range (e.g., unprecedented events with no historical basis for causal modeling)

---

## 6. What Breaks First at Scale

### 6.1 Exposure Data Staleness

**Risk:** Fund composition data is reported on varying schedules — daily for major ETFs, quarterly for mutual funds, inconsistently for international funds. At 3M users with diverse holdings, the system will frequently operate on stale decomposition data.

**Mitigation:** Track data freshness per fund. Flag exposure calculations that rely on data older than configurable thresholds. Fall back to sector-level approximation when holding-level data is stale. Never present stale-data-derived concentrations with the same confidence as fresh-data-derived ones.

### 6.2 Causal Graph Noise

**Risk:** During high-volatility periods (the exact time users most need this tool), the causal graph generates false propagation chains. Everything appears connected to everything. Alert volume spikes. Signal-to-noise ratio collapses.

**Mitigation:** Dynamic confidence thresholds that tighten during high-volatility regimes. Require higher evidence strength for new causal edges during market stress. Cap alert frequency per user regardless of signal volume. Explicitly tell users: "Markets are highly volatile right now. Our causal model is less reliable in these conditions."

### 6.3 Temporal Misclassification

**Risk:** The system classifies an event as "transient" that turns out to be structural (or vice versa). Users who trusted the classification make suboptimal decisions.

**Mitigation:** Track classification accuracy over time. Surface the system's historical track record to users. When classification confidence is below threshold, default to "ambiguous" rather than guessing. Implement a re-evaluation loop — if new signals emerge that contradict the original classification, proactively alert the user that the assessment has changed.

### 6.4 Personalization Accuracy

**Risk:** User profile data is incomplete or outdated. A user's life circumstances change without the system knowing, leading to mismatched recommendations.

**Mitigation:** Periodically prompt users to confirm key profile attributes. Use interaction patterns as secondary signals (e.g., user suddenly checking portfolio 5x/day might indicate changed circumstances). When in doubt, present recommendations for multiple user profiles and let the user self-select.

### 6.5 Recommendation Herding

**Risk:** If 3M users all receive the same "reduce Canadian bank exposure" recommendation simultaneously, their collective action could move markets — creating the very outcome the system predicted.

**Mitigation:** Stagger alert delivery. Vary recommendation specifics (different replacement assets, different magnitudes). Monitor aggregate recommendation patterns across user base and flag when system-wide advice convergence exceeds safety thresholds. This is a regulatory consideration that must involve compliance.

---

## 7. Technical Architecture

### 7.1 Core Stack

```
Frontend:       React + D3.js (causal graph visualization)
LLM:            Gemini 3.1 Pro Preview
Orchestrator:   Google ADK (Agent Development Kit)
Causal Graph:   LLM-generated on-the-fly (prototype) / Neo4j persistent store (production)
Exposure Data:  Pre-loaded sample data (prototype) / ETF holdings APIs (production)
Signal Sources: Gemini with Google Search grounding (real-time market signals, live in prototype)
User Profiles:  Structured user context store (in-memory for prototype)
Notifications:  Simulated in-app (prototype) / Push notification service (production)
```

#### Agent-to-LLM Mapping

| Agent | Uses Gemini? | Execution Mode |
|-------|-------------|----------------|
| Exposure Analyzer | No — pure data pipeline | Triggered on portfolio change |
| Signal Monitor | Yes — Gemini with Google Search grounding | Triggered on portfolio load + periodic refresh |
| Causal Propagation Engine | Yes — multi-hop causal reasoning | Triggered by Signal Monitor |
| Temporal Reasoner | Yes — analytical reasoning with uncertainty | Triggered by Propagation Engine |
| Alert Composer | Yes — personalized natural language generation | Triggered by Temporal Reasoner |
| Chat Agent | Yes — conversational reasoning with citations | On-demand (user interaction) |

#### Causal Chain Generation (Prototype Approach)

For the prototype, there is no pre-seeded causal knowledge graph database. The Causal Propagation Engine uses Gemini to generate causal chains on-the-fly:

1. Signal Monitor detects an event and passes it to the Causal Propagation Engine
2. The engine prompts Gemini with the event context + the user's exposure map and asks it to reason through multi-hop causal propagation
3. Gemini outputs a structured JSON response describing the causal chain: event nodes → mechanism nodes → sector impact nodes → holding impact nodes, with magnitude estimates, confidence scores, and temporal classifications
4. The frontend renders this JSON as the interactive visual graph using D3.js

In production, these generated chains would be persisted to a graph database (Neo4j), building accumulated causal knowledge over time. Previously generated chains can be retrieved and updated when new related events occur, rather than regenerating from scratch.

### 7.2 Data Flow

```
Gemini Google Search ──→ Signal Monitor Agent ──→ Causal Propagation Engine
                                                    │
                                                    ▼
User Portfolio ──→ Exposure Analyzer ──→ Portfolio Impact Mapping
                         │                          │
                         ▼                          ▼
                   Portfolio View           Temporal Reasoner ←── User Profile
                   (X-Ray, holdings)                │
                         ▲                   Alert Composer
                         │                          │
                         │                          ▼
                         │                  Signal Cards (in-app)
                         │                  Push Notifications (external)
                         │                          │
                         │                    user taps
                         │                          ▼
                         │                  Causal Graph View
                         │                          │
                         │                    node click
                         │                          ▼
                         └── back ────────── Chat Panel ──→ Orchestrator
                                                           (routes what-if
                                                            back to agents)
```

### 7.3 Prototype Scope (Demo Build)

For the Wealthsimple application demo, the following will be built real vs. mocked:

| Component | Real | Simulated |
|-----------|------|-----------|
| Portfolio View with holdings list | | ✅ (sample portfolio) |
| Exposure X-Ray (inline on Portfolio View) | ✅ (real decomposition logic) | Holdings data pre-loaded |
| Concentration detection and warnings | ✅ | |
| Signal monitoring (live market events) | ✅ (Gemini with Google Search grounding) | |
| Signal card rendering on Portfolio View | ✅ | |
| Signal card → Causal Graph View navigation | ✅ | |
| Interactive causal graph visualization | ✅ | |
| Causal chain reasoning (live event → portfolio impact) | ✅ (Gemini on-the-fly generation) | |
| Node click → Chat Panel (right-side drawer) | ✅ | |
| Chat drilldown with portfolio + user context | ✅ | |
| Multi-horizon competing recommendations | ✅ | |
| Counterfactual toggle | ✅ | |
| User portfolio holdings | | ✅ (sample data, 4-6 Canadian ETFs) |
| User profile (age, goals, risk tolerance) | | ✅ (2-3 demo personas) |
| ETF composition data | | ✅ (pre-loaded from fund fact sheets) |
| Push notification delivery | | ✅ (simulated in-app) |

#### Demo Flow Sequence

1. **Open Portfolio View** → holdings list renders with X-Ray already populated. Concentration warning visible: "43% Canadian financials across 4 holdings."
2. **Signal Monitor runs** → Gemini with Google Search grounding pulls real, current market events relevant to the user's top exposures. Signal card appears with a live event (whatever is actually happening in markets that day).
3. **Tap signal card** → navigates to Causal Graph View. Gemini generates the full propagation chain on-the-fly from the real event through to the user's specific holdings. Competing effects visible where applicable.
4. **Click a node** → Chat Panel slides in from right. Pre-loaded context. User asks "What should I do?" → system presents rebalancing options with tradeoffs and the explicit tension between time horizons.
5. **Toggle counterfactual** → graph re-renders showing reduced impact if user had rebalanced 3 months ago.

**Key demo strength:** The signal is not scripted. The system is reacting to whatever is actually in the news. This means the demo can be run on any day and produce different, relevant results — proving the system works, not just that a script was followed.

---

## 8. Success Metrics

### User Engagement

- X-Ray engagement: > 60% of users who see the X-Ray interact with it (tap concentration warnings, expand overlapping holdings)
- Signal card tap-through rate > 50% (indicating high relevance)
- Graph interaction depth: average nodes explored per session > 3
- Chat drilldown rate: > 25% of graph interactions lead to chat engagement
- Return rate: users who received a signal card return to the app within 24 hours > 60%

### User Outcomes

- Users who engage with the system demonstrate reduced portfolio concentration over 6 months
- Users who act on structural risk alerts experience lower drawdowns in relevant events vs. non-users
- User-reported understanding of their portfolio composition increases (survey-based)

### System Quality

- Temporal classification accuracy > 70% (measured retroactively)
- Causal propagation relevance: > 80% of surfaced chains rated "relevant" by users
- Alert precision: < 10% of alerts dismissed without interaction
- False positive rate for concentration detection < 5%

---

## 9. Regulatory & Compliance Considerations

- System does NOT constitute financial advice under Canadian securities law. All outputs are educational analysis and informational suggestions only.
- Rebalancing suggestions are presented as "options to consider" with explicit tradeoffs, never as directives.
- The system must log all recommendations generated and user actions taken for audit trail purposes.
- Any aggregate user behavior patterns (e.g., recommendation herding) must be monitored and reported to compliance.
- User data handling must comply with Wealthsimple's existing privacy architecture — the system operates within the same security perimeter as portfolio data.
- The system must include clear disclaimers that past causal patterns may not predict future outcomes.

#### Required Disclaimer (displayed on all analysis screens)

The following disclaimer must be persistently visible on the Portfolio X-Ray, Signal Cards, Causal Graph View, and Chat Panel:

> **This is not financial advice.** Prism provides educational analysis, informational suggestions, and general commentary about your portfolio exposure and market events. It does not provide personalized financial advice, and its outputs should not be interpreted as recommendations to buy, sell, or hold any security. All investment decisions are your own. Past causal patterns may not predict future outcomes. Consult a qualified financial advisor before making investment decisions.

---

## 10. Competitive Positioning

| Feature | Bloomberg Terminal | Robo-Advisors | Trading Apps | Prism |
|---------|-------------------|---------------|--------------|--------------|
| Look-through exposure | ✅ | ❌ | ❌ | ✅ |
| Causal event reasoning | Partial (manual) | ❌ | ❌ | ✅ (automated) |
| Multi-horizon analysis | ✅ (manual) | ❌ | ❌ | ✅ (automated) |
| Personalized to user context | ❌ | Basic | ❌ | ✅ (deep) |
| Proactive alerts | ❌ | Generic | Price-based | Causal + personalized |
| Visual causal graph | ❌ | ❌ | ❌ | ✅ |
| Conversational drilldown | ❌ | ❌ | ❌ | ✅ |
| Cost | ~$25K/year | Included | Free | Included / Premium |

**Positioning statement:** Bloomberg-grade portfolio intelligence, delivered through an interface a retail investor can actually use, personalized to their specific holdings and life context, running proactively instead of waiting to be asked.

---

## 11. Design Decisions

1. **Fund data sourcing (prototype):** The prototype uses pre-loaded sample data for ETF/fund composition. Sample portfolios include 4-6 Canadian-listed ETFs (e.g., VFV, XIC, ZAG, XQQ) with manually compiled top holdings data sourced from fund provider fact sheets (Vanguard Canada, iShares, BMO). For production, the recommended approach is ingesting daily holdings files published by major Canadian ETF providers (Vanguard, BlackRock/iShares, BMO, CI) via their public data feeds. For mutual funds that report holdings quarterly, the system falls back to sector-level approximation using fund category classification and flags the analysis as based on stale data.

2. **Regulatory boundary:** Resolved — the system is explicitly positioned as educational analysis, not financial advice. A persistent disclaimer is displayed on all analysis screens (see Section 9). The system never uses directive language ("you should buy/sell") and always presents options with tradeoffs. The Chat Agent is instructed to refuse definitive buy/sell recommendations.

3. **Causal graph generation:** For the prototype, there is no pre-seeded causal knowledge graph. The Causal Propagation Engine uses Gemini to generate causal chains on-the-fly — the LLM receives the event context and the user's exposure map, then outputs structured JSON describing the multi-hop propagation chain. The frontend renders this JSON as the interactive visual graph using D3.js. In production, generated chains would be persisted to build accumulated causal knowledge. See Section 7.1 for implementation details.

4. **Multi-account visibility:** The system aggregates holdings across ALL of a user's Wealthsimple accounts (TFSA, RRSP, FHSA, non-registered) into a single unified exposure map. This is the correct approach because hidden concentration risk is a cross-account problem — a user might hold Canadian bank ETFs in both their TFSA and RRSP without realizing the combined exposure. The Exposure Analyzer treats the full account set as one portfolio for decomposition purposes, but tracks which holdings belong to which account type so that rebalancing suggestions can account for tax implications (e.g., "sell in non-registered first to harvest the tax loss, keep the TFSA position").

5. **Options integration:** Out of scope for the prototype. Options positions are excluded from exposure analysis. To be revisited in a future iteration when Wealthsimple's advanced options strategies are fully launched.

6. **Premium tier potential:** Out of scope for the prototype. Tiering decisions are a product/business decision for Wealthsimple to make post-validation.