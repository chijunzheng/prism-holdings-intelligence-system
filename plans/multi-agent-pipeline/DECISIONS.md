# Multi-Agent Pipeline — Design Decisions Log

## Decision 1: Unified LangGraph (ADK Removed)
**Date:** 2026-02-28
**Decision:** Use LangGraph for everything — pipeline, chat, sessions. Remove ADK entirely.
**Rationale:** Single framework simplifies state management, debate loops, human-in-the-loop, and follow-up routing. ADK lacks interrupt_before for checkpoints.
**Trade-offs:** LangGraph JS is newer than Python version; some features may have rough edges.

## Decision 2: Computation-First Dollar Impacts
**Date:** 2026-02-28
**Decision:** LLMs handle qualitative reasoning (direction, causation). All dollar amounts computed from real Yahoo Finance data via formula.
**Rationale:** LLM-guessed dollar amounts are indefensible. Real volatility + correlation + Monte Carlo produces calibrated, auditable numbers.
**Trade-offs:** Requires Yahoo Finance API dependency; adds ~2-3s latency for data fetching.

## Decision 3: Single Chat Interface (Replace Multi-Page SPA)
**Date:** 2026-02-28
**Decision:** Replace entire multi-page UI with a single chat interface. Everything renders as rich cards.
**Rationale:** Chat is more natural for AI-driven experience. Eliminates page navigation complexity. Matches Wealthsimple simplicity principle.
**Trade-offs:** Loses spatial layout of dedicated pages; all information must fit card format.

## Decision 4: Bull/Bear Debate Protocol
**Date:** 2026-02-28
**Decision:** Structured adversarial debate (2-3 rounds) between Bull and Bear researchers before risk team.
**Rationale:** TradingAgents showed debate improves Sharpe ratio. Corrects correlated errors from 4 analysts sharing same signal framing.
**Trade-offs:** Adds 3-5s to pipeline latency; requires careful convergence detection.

## Decision 5: Monte Carlo with Real Correlation Matrix
**Date:** 2026-02-28
**Decision:** 10,000-simulation Monte Carlo using actual ETF correlation matrix from Yahoo Finance returns.
**Rationale:** Hardcoded scenarios (base/50%/reversal) are arbitrary. Monte Carlo with real correlations produces industry-standard VaR/CVaR metrics.
**Trade-offs:** Computationally intensive; Cholesky decomposition required; correlation matrix may be unstable for short histories.

## Decision 6: Human Checkpoints at Debate + Stress Test
**Date:** 2026-02-28
**Decision:** Two interrupt_before checkpoints: after debate resolution and after stress test.
**Rationale:** Debate checkpoint lets users correct assumptions (highest-value input). Stress test checkpoint lets users choose risk scenario (calibrates recommendations).
**Trade-offs:** Adds user wait time; must handle the case where user never responds.

## Decision 7: Three Demo Profiles (Marcus, Sarah, Diana)
**Date:** 2026-02-28
**Decision:** Replace generic demo portfolios with 3 exaggerated but realistic personas.
**Rationale:** Each showcases different capabilities: Marcus (concentration risk), Sarah (time-horizon mismatch), Diana (hidden overlap). More compelling demo.
**Trade-offs:** Requires 5 new fund data files for single stocks.

## Decision 8: Final Codebase Cleanup Before GCP Deployment
**Date:** 2026-02-28
**Decision:** Reordered phases so Final Codebase Cleanup (Phase 9) runs before GCP Deployment (Phase 10). Feature 21 (cleanup) depends on 00-19; Feature 20 (deployment) depends on 17 + 21.
**Rationale:** Deploying dead code to production wastes resources and increases attack surface. Cleaning up first ensures we deploy a lean, audited codebase. Also easier to debug deployment issues when the codebase is clean.
**Trade-offs:** None — strictly better ordering.

## Decision 9: Event-Driven Thinking Visibility (Auto-Promotion Pattern)
**Date:** 2026-03-01
**Decision:** When SSE thinking events arrive async to pending stages, auto-promote pending→active and mark predecessors complete.
**Rationale:** Pipeline stages emit thinking text while still executing (before completion event). Pending stages don't render thinking in UI. Auto-promotion infers state from data flow: "if stage is receiving events, it must be running".
**Evidence:** Root cause of "user sees nothing during analysis" bug. Pattern works because stages can't run unless predecessors finished (DAG topology).
**Trade-offs:** None — more accurate than relying on explicit completion events.

## Decision 10: ThinkingCard Insertion on Substantive Stages Only
**Date:** 2026-03-01
**Decision:** Define `THINKING_CARD_STAGES` set (analyst_complete, debate_complete, risk_challenge, magnitude_validation, stress_complete, verdict, judge). Only these stages produce chat-visible ThinkingCards.
**Rationale:** Prep stages (risk_profile, market_data) emit events but don't have meaningful reasoning to show. Filtering prevents chat spam; keeps focus on analytical output.
**Implementation:** Set defined in ChatArea.tsx; checked in 3 SSE handlers (initial, resume, unified chat).
**Trade-offs:** Adding new substantive stages requires set update (low friction).

## Decision 11: Message Enrichment: Three Levels
**Date:** 2026-03-01
**Decision:** Separate thinking into 3 levels of detail:
- **onThinking callbacks:** Real-time agent status ("analyst: evaluating signal impact...")
- **summarizeNodeOutput:** Completion summary with metrics ("4 analysts, independent perspectives across dimensions")
- **ThinkingCard message:** Combines both for user-facing chat visibility

**Rationale:** Real-time status signals agent is working. Summary conveys what was accomplished. Separation allows backend + frontend to evolve independently.
**Evidence:** Without enrichment, users see generic messages ("completed") and don't understand what analysis occurred.
**Trade-offs:** Requires updates in 7 files (analyst runner, orchestrator, debate protocol, index.ts). Slight redundancy (status + summary), but necessary for visibility.

## Decision 12: ThinkingCard CSS: Left Border Color Coding
**Date:** 2026-03-01
**Decision:** ThinkingCards use 3px left border: blue (#2563EB) for active, green (#16A34A) for complete. Elevated background (#F8F7F5).
**Rationale:** Color-coding makes completion state immediately visible (no need to read text). Elevated background separates from chat content. Left border is Wealthsimple pattern (used in blockquotes).
**Visual Hierarchy:** ThinkingCard > chat text > progress bar (background + border + spacing).
**Trade-offs:** None — pure UX improvement.
