# Multi-Agent Pipeline — Progress Tracker

**Last Updated:** 2026-02-28

## Phase 0: Project Setup + Plan Persistence
- [x] Plan saved to `plans/multi-agent-pipeline/` (original plan in context)
- [x] Progress tracker created (`PROGRESS.md`)
- [x] Decision log created (`DECISIONS.md`)
- [x] Feature files created (21 features in `features/00-20.md`)
- [x] Overview file created (`00-overview.md`)

## Phase 0.5: Codebase Cleanup (Partial)
- [ ] Delete dead frontend routes, components, hooks, styles
- [ ] Delete dead server services
- [ ] Delete dead shared types
- [x] Remove ADK dependency (`pnpm remove @google/adk`)
- [ ] Delete ADK directory (`agents/src/adk/`)
- [ ] Refactor server/src/index.ts into route modules
- [ ] Refactor orchestrator/index.ts
- [ ] Clean up chat-agent dead functions
- [ ] Update App.tsx to single route
- [x] Install LangGraph dependencies (`@langchain/langgraph`, `@langchain/google-genai`, `@langchain/core`)
- [ ] Verify pnpm build succeeds after cleanup

## Phase 1: Types + Risk Inference + Calibration
- [x] Create `shared/src/types/multi-agent.ts` — all Zod schemas (AnalystAssessment, DebateArgument, DebateResolution, RiskChallenge, MagnitudeValidation, StressTestResult, JudgeVerdict, FundManagerVerdict, InferredRiskProfile, PortfolioVerdict, ResearchBrief, etc.)
- [x] Extend `shared/src/types/user-profile.ts` — HoldingsConsent + UserExpectations schemas
- [x] Update `shared/src/index.ts` — export multi-agent types
- [x] Implement `agents/src/multi-agent/risk-profile-inference.ts` — pure computation risk profiler (scoring, FHSA mismatch, duplicate holdings, declared vs inferred)
- [x] Implement `agents/src/multi-agent/calibration.ts` — formula-based dollar impact (calibrateImpact, aggregateHoldingImpacts, calibrateAllHoldings)
- [x] Implement `agents/src/multi-agent/market-data.ts` — Yahoo Finance data service (OHLCV fetch, volatility, correlation, event impact, 24h cache, fallbacks)
- [ ] Implement Monte Carlo stress testing (`risk-team/portfolio-stress.ts`)
- [x] Create demo portfolios: `data/portfolios/marcus-01.json` ($30K YOLO), `sarah-01.json` ($53K couch potato), `diana-01.json` ($72K advisor nightmare)
- [x] Create user profiles: `data/user-profiles/marcus-01.json`, `sarah-01.json`, `diana-01.json`
- [x] Create single stock fund files: `data/funds/NVDA.json`, `TSLA.json`, `BTCX.B.json`, `RY.json`, `ENB.json`
- [x] Update `data/index.ts` — register new portfolio, profile, and fund files
- [x] Create `agents/src/multi-agent/index.ts` — public API stub (runMultiAgentAnalysis, runPortfolioReview)
- [x] Unit tests: 38/38 passing
  - `risk-profile-inference.test.ts` — 12 tests (Marcus high risk, Sarah moderate + FHSA mismatch + duplicates, Diana moderate + horizon, edge cases)
  - `calibration.test.ts` — 14 tests (direction, bounds, haircut, historical anchoring, time scaling, aggregation)
  - `market-data.test.ts` — 12 tests (log returns, std dev, Pearson correlation, correlation matrix, volatility)

## Phase 2: Analyst Agents
- [ ] Build shared prompt context builder
- [ ] Implement 4 analyst agents with Gemini Search
- [ ] Wire LangGraph Send() fan-out
- [ ] Test each analyst independently

## Phase 3: Researcher Debate
- [ ] Implement Bull Researcher
- [ ] Implement Bear Researcher
- [ ] Implement debate-protocol.ts (loop + convergence)
- [ ] Wire LangGraph conditional edges
- [ ] Test debate produces valid DebateResolution

## Phase 4: Risk Management Team
- [ ] Implement Assumptions Challenger
- [ ] Implement Magnitude Validator
- [ ] Implement Portfolio Stress Tester
- [ ] Wire sequential edges

## Phase 5: Fund Manager + Judge
- [ ] Implement Fund Manager synthesis
- [ ] Implement Judge scoring + convergence
- [ ] Wire conditional loop edges
- [ ] Implement research-brief.ts template
- [ ] End-to-end test: signal → FundManagerVerdict

## Phase 5.5: Cross-Signal Synthesizer
- [ ] Implement cross-signal aggregation (pure computation)
- [ ] Implement interaction classification
- [ ] Implement LLM insights + holistic recommendations
- [ ] Implement runPortfolioReview()
- [ ] Test offsetting/compounding interactions

## Phase 6: Integration + Cache
- [ ] Wire pipeline into server endpoints (SSE)
- [ ] Implement CacheStore interface
- [ ] Implement follow-up query classification
- [ ] Wire cached artifacts into chat agent
- [ ] Integration tests

## Phase 7: Chat UI
- [ ] Build left panel (holdings, sessions, expectations)
- [ ] Build main chat area
- [ ] Build 15+ card components
- [ ] Wire holdings interaction
- [ ] Wire checkpoint interactions
- [ ] Session management

## Phase 8: Evaluation
- [ ] Curate 25 historical events
- [ ] Fetch ground truth prices
- [ ] Build eval harness
- [ ] Run comparison: multi-agent vs single-agent
- [ ] Generate report

## Phase 9: Final Codebase Cleanup
- [ ] Run `knip`/`ts-prune` to identify unused exports across all packages
- [ ] Delete orphaned frontend components and CSS files
- [ ] Remove dead agent code (old orchestrator, temporal reasoner, strategy engine)
- [ ] Clean up unused shared types (CausalChain, StrategyCandidate, etc.)
- [ ] Remove dead server endpoints and services
- [ ] Remove unused npm dependencies (`depcheck`)
- [ ] Remove dead hooks, utilities, and helper functions
- [ ] Clean up shared/src/index.ts exports
- [ ] Remove stale TODO/DEPRECATED comments
- [ ] Run `pnpm build` — 0 errors
- [ ] Run full test suite — all pass
- [ ] Document line count before/after

## Phase 10: GCP Deployment
- [ ] Dockerfiles
- [ ] Firestore setup
- [ ] Redis cache
- [ ] Deploy to Cloud Run
- [ ] Share URL

---

## Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 0: Setup | ✅ Complete | 5/5 |
| Phase 0.5: Cleanup | 🔄 Partial | 2/10 |
| Phase 1: Foundation | 🔄 In Progress | 12/13 |
| Phase 2: Analysts | ⬜ Not Started | 0/4 |
| Phase 3: Debate | ⬜ Not Started | 0/5 |
| Phase 4: Risk Team | ⬜ Not Started | 0/4 |
| Phase 5: Synthesis | ⬜ Not Started | 0/5 |
| Phase 5.5: Cross-Signal | ⬜ Not Started | 0/5 |
| Phase 6: Integration | ⬜ Not Started | 0/5 |
| Phase 7: Chat UI | ⬜ Not Started | 0/6 |
| Phase 8: Evaluation | ⬜ Not Started | 0/5 |
| Phase 9: Final Cleanup | ⬜ Not Started | 0/12 |
| Phase 10: Deployment | ⬜ Not Started | 0/5 |

**Tests:** 38/38 passing (risk-profile-inference: 12, calibration: 14, market-data: 12)
