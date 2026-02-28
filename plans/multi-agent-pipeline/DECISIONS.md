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
