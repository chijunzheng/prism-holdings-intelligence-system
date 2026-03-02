# Prism Documentation Index

Complete technical documentation for Prism's AI-native portfolio intelligence system.

---

## 🏗️ Architecture & Design

### [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md)
**Learn:** How the 7-stage pipeline works, from analyst team → debate → risk team → synthesis
- **Stages:** Risk profile → analysts → debate → risk team → fund manager → judge → brief
- **Key insight:** Adversarial debate catches correlated analyst errors; debate improves Sharpe ratio by 8-12%
- **Innovation:** Human-in-the-loop checkpoints at debate + stress test for user domain knowledge injection
- **Latency:** <6s per signal with 6-phase optimization
- **Evaluation:** 84% directional accuracy vs 72% single-agent baseline

**When to read:** Understanding system capabilities, contributing to pipeline stages

---

### [Single Chat Interface — UI Architecture](./SINGLE-CHAT-INTERFACE-UI.md)
**Learn:** Why chat replaced multi-page dashboard, how cards compose, SSE streaming
- **Design:** Everything in one conversation thread; no page navigation
- **Cards:** 9 card types (signal, progress, thinking, debate, stress, recommendation, research brief, playbook, impact delta)
- **Progressive disclosure:** Start with verdict, expand to see reasoning, debate, audit trail
- **Interaction:** Tap-first (clickable cards, not typing required)
- **Performance:** <10ms time-to-first-response via SSE streaming

**When to read:** Understanding UX philosophy, adding new card types, UI state management

---

### [Computation-First Dollar Impacts](./COMPUTATION-FIRST-DOLLAR-IMPACTS.md)
**Learn:** Why LLMs never generate dollar amounts directly; 6-layer anchoring system
- **Layer 1:** Portfolio value bounds (impact ≤ holding value)
- **Layer 2:** Exposure weights (impact ≤ affected exposure slice)
- **Layer 3:** Historical volatility (impact bounded by market reality)
- **Layer 4:** Multi-analyst consensus (LLMs provide direction + magnitude 0-1)
- **Layer 5:** Formula calibration (convert magnitude to dollars with uncertainty ranges)
- **Layer 6:** Monte Carlo stress testing (10k simulations with real correlations)
- **Validation:** 78% range coverage on 25 historical events

**When to read:** Understanding calibration logic, working with impact estimates, audit trail derivation

---

### [Human-In-The-Loop Checkpoints](./HUMAN-IN-THE-LOOP-CHECKPOINTS.md)
**Learn:** How users inject domain knowledge at key pipeline stages
- **Two types:** Soft (auto-continue 60s) vs Hard (user must decide)
- **Checkpoint 1:** After debate (user corrects assumptions)
- **Checkpoint 2:** After stress test (user selects risk scenario)
- **Implementation:** LangGraph `interrupt()` with `interrupt_before` edges
- **UX:** Soft checkpoints show progress; hard checkpoints pause for user input
- **Resume:** Frontend sends POST with `humanInput` + `inputType`

**When to read:** Understanding user interaction in guided mode, implementing checkpoint UI, designing human-in-the-loop features

---

## 🖥️ Backend & Infrastructure

### [Signal Detection & Monitoring](./SIGNAL-DETECTION-AND-MONITORING.md)
**Learn:** How live market events are discovered in real-time
- **Pattern:** Gemini + Google Search for exposure-scoped discovery
- **Two phases:** Exposure scoping (deterministic) + LLM search (real-time)
- **Caching:** 15-min TTL for signals found, 1-min for no signals
- **Relevance filtering:** Only signals with score ≥0.3 included
- **Deduplication:** Prevents duplicate "Oil up" / "Oil rises" signals
- **Cache hit rate:** ~75% during business hours

**When to read:** Understanding signal discovery, improving search quality, adding signal sources

---

### [Server API Architecture](./SERVER-API-ARCHITECTURE.md)
**Learn:** Endpoints, SSE streaming, session management, checkpoint resumption
- **Main endpoint:** POST /api/v2/analyze with SSE streaming
- **Checkpoint resumption:** POST /api/v2/analyze/{threadId}/resume
- **Portfolio review:** POST /api/v2/analyze/portfolio (multi-signal synthesis)
- **Session CRUD:** /api/v2/sessions for conversation history
- **Data endpoints:** /api/portfolio, /api/exposure, /api/signals
- **Streaming:** <10ms TTFR via SSE; progress events ~1s apart
- **Caching:** 24h TTL for verdicts + market data

**When to read:** Understanding backend architecture, building frontend integrations, adding new endpoints, debugging server issues

---

### [Risk Management Team](./RISK-MANAGEMENT-TEAM.md)
**Learn:** How assumptions are challenged and estimates are validated
- **3-agent structure:** Assumptions Challenger (devil's advocate) + Magnitude Validator (volatility bounds) + Stress Tester (Monte Carlo)
- **Parallel execution:** All 3 run simultaneously → 1.5s wall-clock vs 2.8s sequential
- **Assumptions Challenger:** Finds counter-evidence, applies confidence haircut (-10% to -50%)
- **Magnitude Validator:** Flags estimates >2x historical volatility, clamps to realistic bounds
- **Stress Tester:** Computes VaR/CVaR across base, downside, tail risk scenarios
- **Soft Checkpoint 1.5:** Shows challenges found; user can continue or override

**When to read:** Understanding risk validation, preventing analyst groupthink, understanding stress testing

---

### [Cross-Signal Synthesis: Portfolio-Level Impact](./CROSS-SIGNAL-SYNTHESIS.md)
**Learn:** How multiple signals interact; net vs gross impact calculation
- **Interaction types:** Independent, Offsetting (signals cancel), Compounding (signals amplify)
- **Computation:** Aggregate per-holding impacts, classify interactions, compute portfolio net/gross
- **LLM phase:** Generate interaction insights + holistic recommendations
- **Example:** Rate hike -$300, oil drop -$400 separately, but offsetting RY holding means net -$480 vs gross -$600
- **Result:** PortfolioVerdict with interaction summaries + portfolio-level recommendations

**When to read:** Understanding portfolio review mode, implementing cross-signal features, analyzing interaction effects

---

## 🚀 Performance & Optimization

### [Latency Optimization: 5.5s → <10ms TTFR](./LATENCY-OPTIMIZATION.md)
**Learn:** 6-phase optimization program that reduced analysis latency while improving perceived responsiveness
- **Phase 1:** Parallel prep stages (1s saved)
- **Phase 2:** Shared analyst context (3s saved via 4x reduction in formatting)
- **Phase 3:** Parallel Bull/Bear Round 1 (2s saved)
- **Phase 4:** Parallel risk team (1.5s saved)
- **Phase 5:** Streaming SSE (TTFR: 5.5s → <10ms)
- **Phase 6:** Market data caching (24h TTL, 1s saved on repeat)
- **Result:** <6s end-to-end, <10ms time-to-first-response

**When to read:** Understanding latency bottlenecks, contributing to performance optimization

---

## 📊 Quality & Evaluation

### [Evaluation Framework: Measuring Analysis Quality](./EVALUATION-FRAMEWORK.md)
**Learn:** How to objectively score financial analysis quality using ground truth historical returns
- **Dataset:** 25 historical macro/sector events with 5-day ground truth returns
- **Metrics:** Directional accuracy, range coverage, evidence grounding
- **Baseline:** Single-agent LLM (72% directional accuracy)
- **Multi-agent result:** 84% (+12 points)
- **Strengths:** Rate changes, inflation, oil price, sector events
- **Weaknesses:** FX/commodities (needs crypto-aware analyst)
- **Validation:** Dollar estimate MAE -41% vs single-agent

**When to read:** Contributing to evaluation, understanding quality metrics, debugging analysis accuracy

---

## 🔧 Recent Fixes & Improvements

### [Checkpoint & Thinking Visibility Hotfix](./CHECKPOINT-VISIBILITY-HOTFIX.md)
**Learn:** 5 bugs that prevented checkpoints and agent reasoning from being visible
- **Bug 1:** effectiveMode ternary logic error (both branches returned 'quick')
- **Bug 2:** Thinking text invisible due to event timing (pending stages don't render thinking)
- **Bug 3:** No visible trail of agent reasoning (ThinkingCards never inserted)
- **Bug 4:** onThinking messages too brief (status updates, not reasoning)
- **Bug 5:** summarizeNodeOutput generic (don't convey what was found)
- **Bug 6:** ThinkingCard CSS not prominent (no visual hierarchy)
- **Fix:** Auto-promotion pattern + ThinkingCard insertion + message enrichment

**When to read:** Understanding recent bug fixes, learning from debugging process

---

## 📚 How to Navigate This Documentation

### By Role

**Product/Design:**
1. Start with [Single Chat Interface — UI Architecture](./SINGLE-CHAT-INTERFACE-UI.md)
2. Read [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md) for capabilities
3. Review [Evaluation Framework](./EVALUATION-FRAMEWORK.md) for quality metrics

**Backend Engineer:**
1. Start with [Server API Architecture](./SERVER-API-ARCHITECTURE.md) for endpoint design
2. Read [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md) for agent orchestration
3. Study [Risk Management Team](./RISK-MANAGEMENT-TEAM.md) for validation layer
4. Review [Computation-First Dollar Impacts](./COMPUTATION-FIRST-DOLLAR-IMPACTS.md) for calibration logic
5. Check [Cross-Signal Synthesis](./CROSS-SIGNAL-SYNTHESIS.md) for portfolio review mode
6. Study [Latency Optimization](./LATENCY-OPTIMIZATION.md) for performance patterns
7. Check [Checkpoint Visibility Hotfix](./CHECKPOINT-VISIBILITY-HOTFIX.md) for recent changes

**Frontend Engineer:**
1. Start with [Single Chat Interface — UI Architecture](./SINGLE-CHAT-INTERFACE-UI.md) for card design
2. Read [Server API Architecture](./SERVER-API-ARCHITECTURE.md) for endpoint integration
3. Study [Human-In-The-Loop Checkpoints](./HUMAN-IN-THE-LOOP-CHECKPOINTS.md) for checkpoint UI patterns
4. Review [Checkpoint Visibility Hotfix](./CHECKPOINT-VISIBILITY-HOTFIX.md) for recent SSE handling
5. Check [Latency Optimization](./LATENCY-OPTIMIZATION.md) for rendering performance

**Data/ML Engineer:**
1. Start with [Evaluation Framework](./EVALUATION-FRAMEWORK.md)
2. Read [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md) for agent patterns
3. Review [Computation-First Dollar Impacts](./COMPUTATION-FIRST-DOLLAR-IMPACTS.md) for calibration formulas

**DevOps/Infra:**
1. Read [Latency Optimization](./LATENCY-OPTIMIZATION.md) for bottleneck understanding
2. Review [Evaluation Framework](./EVALUATION-FRAMEWORK.md) for testing/monitoring

### By Topic

**Understanding the core analysis engine:** Multi-Agent Pipeline Architecture
**Understanding user experience:** Single Chat Interface — UI Architecture + Human-In-The-Loop Checkpoints
**Understanding backend architecture:** Server API Architecture
**Understanding portfolio-level analysis:** Cross-Signal Synthesis
**Understanding why numbers are reliable:** Computation-First Dollar Impacts
**Understanding performance characteristics:** Latency Optimization
**Verifying quality:** Evaluation Framework
**Learning from recent work:** Checkpoint Visibility Hotfix

---

## 🔍 Key Concepts at a Glance

### Pipeline Stages
```
Stage 0: Risk Profile Inference (pure computation)
Stage 1: Market Data Fetching (Yahoo Finance)
Stage 2: Analyst Team (4 parallel Gemini Flash agents)
Stage 3: Researcher Debate (Bull vs Bear, 2-3 rounds)
Stage 4: Risk Management Team (assumptions challenger, magnitude validator, stress tester)
Stage 5: Fund Manager (synthesis)
Stage 6: Judge (quality gates)
Stage 7: Research Brief Generator (audit trail)
```

### Human Checkpoints
```
Checkpoint 1 (after debate): User corrects assumptions before risk team runs
Checkpoint 2 (after stress test): User selects risk scenario (base/downside/tail)
```

### Card Types
```
Signal → Analysis → Progress/Thinking → Debate/Stress → Recommendation/Brief → Playbook
```

### Performance Timeline
```
0ms: Click Analyze
10ms: TTFR (progress bar appears via SSE)
1s: First ThinkingCard
2s: Debate result
4s: Risk team completion
6s: Final verdict + recommendations
```

---

## 📖 Design Philosophy Summary

**Core Principle:** AI drives the experience, not a tool users open a drawer to access

**Design Boundaries:**
- AI responsible for: Decomposing exposure, detecting signals, multi-perspective analysis, adversarial debate, calibrated estimation, stress testing, narration, plan generation
- Human responsible for: Deciding whether to act, selecting which plan, trade execution

**UX Principles:**
- Wealthsimple simplicity: Hide complexity, surface clarity
- Single chat interface: Everything in one conversation
- Tap-first interaction: Clickable cards, not typing
- Plain English: Dollar amounts, everyday language
- Progressive disclosure: Verdict first, details on demand
- "Do nothing" always an option: Show cost of inaction

**Computation-First:**
- LLMs do reasoning (direction, causation, magnitude 0-1 score)
- Formulas do numbers (volatility, correlation, dollar impact, stress testing)
- No dollar amount comes directly from LLM
- All estimates bounded by 6-layer anchoring system

---

## 🔗 External References

**Key Papers:**
- [TradingAgents (NVIDIA)](https://research.nvidia.com/): Adversarial debate improves Sharpe ratio
- [AlphaAgents](https://www.arxiv.org/): Multi-agent debate with risk tolerance
- [FINCON](https://openreview.net/): Manager-analyst hierarchies for financial decisions
- [Google/MIT Scaling Study](https://arxiv.org/): Centralized hierarchical > peer-to-peer for complex tasks

**Technologies:**
- LangGraph: Agent orchestration with human-in-the-loop
- Gemini Flash: Fast, grounded LLM with Search plugin
- Yahoo Finance API: Market data (volatility, correlation, prices)
- React 19 + Vite: Frontend
- Express.js: Backend
- pnpm workspaces: Monorepo package management

---

## 📝 Contributing to Documentation

When adding new features or major changes:
1. Update relevant existing doc (if fits existing category)
2. Or create new doc with clear naming: `<FEATURE>-<ASPECT>.md`
3. Add entry to this INDEX
4. Update `plans/multi-agent-pipeline/DECISIONS.md` with design rationale

---

## 🗂️ Document Status

| Document | Status | Last Updated | Comments |
|----------|--------|--------------|----------|
| INDEX (Navigation) | ✅ Complete | 2026-03-01 | Master navigation for all docs |
| Multi-Agent Pipeline Architecture | ✅ Complete | 2026-03-01 | Comprehensive, includes all 7 stages + checkpoints |
| Single Chat Interface UI | ✅ Complete | 2026-03-01 | 9 card types, SSE streaming, state flow |
| Computation-First Dollar Impacts | ✅ Complete | 2026-03-01 | 6-layer anchoring, formulas, examples |
| Human-In-The-Loop Checkpoints | ✅ Complete | 2026-03-01 | Soft/hard checkpoints, resume pattern, UX flow |
| Server API Architecture | ✅ Complete | 2026-03-01 | Endpoints, SSE streaming, checkpoint resumption |
| Signal Detection & Monitoring | ✅ Complete | 2026-03-01 | Gemini + Google Search, exposure-scoped discovery |
| Risk Management Team | ✅ Complete | 2026-03-01 | 3-agent validation: assumptions, magnitude, stress |
| Cross-Signal Synthesis | ✅ Complete | 2026-03-01 | Portfolio review, interaction types, net vs gross |
| Latency Optimization | ✅ Complete | 2026-03-01 | 6 phases, bottleneck analysis, monitoring |
| Evaluation Framework | ✅ Complete | 2026-03-01 | 25 events, metrics, failure analysis |
| Checkpoint Visibility Hotfix | ✅ Complete | 2026-03-01 | 6 bugs fixed, auto-promotion pattern |

**Total Documentation:** ~200KB across 12 comprehensive files
**Coverage:** Core architecture, signal detection, risk validation, backend/frontend integration, portfolio analysis, performance, quality metrics, recent fixes

### Documentation Highlights This Session

**New docs created:**
- Human-In-The-Loop Checkpoints (450 lines)
- Cross-Signal Synthesis (545 lines)
- Server API Architecture (718 lines)
- Signal Detection & Monitoring (543 lines)
- Risk Management Team (510 lines)

**Total new content:** ~2,700 lines (~50KB) covering 5 major feature areas

---

**Last Updated:** 2026-03-01
**Version:** 1.1
