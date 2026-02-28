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
- [x] Delete ADK directory (`agents/src/adk/`)
- [ ] Refactor server/src/index.ts into route modules
- [ ] Refactor orchestrator/index.ts
- [x] Clean up chat-agent dead functions (stubbed ADK import)
- [ ] Update App.tsx to single route
- [x] Install LangGraph dependencies (`@langchain/langgraph`, `@langchain/google-genai`, `@langchain/core`)
- [ ] Verify pnpm build succeeds after cleanup

## Phase 1: Types + Risk Inference + Calibration
- [x] Create `shared/src/types/multi-agent.ts` — all Zod schemas
- [x] Extend `shared/src/types/user-profile.ts` — HoldingsConsent + UserExpectations schemas
- [x] Update `shared/src/index.ts` — export multi-agent types
- [x] Implement `agents/src/multi-agent/risk-profile-inference.ts` — pure computation risk profiler
- [x] Implement `agents/src/multi-agent/calibration.ts` — formula-based dollar impact
- [x] Implement `agents/src/multi-agent/market-data.ts` — Yahoo Finance data service
- [x] Implement Monte Carlo stress testing (`risk-team/portfolio-stress.ts`)
- [x] Create demo portfolios and user profiles
- [x] Create single stock fund files
- [x] Update `data/index.ts`
- [x] Create `agents/src/multi-agent/index.ts` — public API with LangGraph orchestrator

## Phase 2: Analyst Agents
- [x] Build shared prompt context builder (`analysts/shared-prompt.ts`)
- [x] Implement 4 analyst agents with Gemini Flash (`macro`, `fundamental`, `sentiment`, `technical`)
- [x] `runAllAnalysts()` parallel execution via Promise.all
- [x] Core runner with Zod validation-retry (`analysts/run-analyst.ts`)

## Phase 3: Researcher Debate
- [x] Implement Bull Researcher (`researchers/bull-researcher.ts`)
- [x] Implement Bear Researcher (`researchers/bear-researcher.ts`)
- [x] Implement debate-protocol.ts (loop + convergence detection + resolution)
- [x] Convergence: direction agreement OR mutual concessions
- [x] 6 unit tests for hasConverged

## Phase 4: Risk Management Team
- [x] Implement Assumptions Challenger (LLM with Search grounding + human correction)
- [x] Implement Magnitude Validator (pure computation, volatility bounds)
- [x] Implement Portfolio Stress Tester (Monte Carlo, Cholesky decomposition, 10K sims)
- [x] 16 unit tests (10 stress, 6 magnitude)

## Phase 5: Fund Manager + Judge + Orchestrator
- [x] Implement Fund Manager synthesis (5-step: debate → risk → calibrate → recommend → verdict)
- [x] Implement Judge scoring (5 dimensions, weighted, convergence threshold 0.65)
- [x] Implement judge fallback verdict (structural analysis without LLM)
- [x] Implement research-brief.ts template (10 sections, pure formatting, no LLM)
- [x] Implement LangGraph StateGraph orchestrator (`orchestrator.ts`)
- [x] Implement pipeline state with Annotation (`state.ts`)
- [x] Wire all nodes: prep → analysts → debate → checkpoint1 → risk team → checkpoint2 → synthesis → judge loop → brief
- [x] Conditional edges for judge loop (quality < 0.65 → re-synthesize, max 2)
- [x] `interrupt()` for human-in-the-loop at debate resolution and stress test
- [x] `compilePipeline()` (with MemorySaver) and `compilePipelineNoCheckpoints()` (for eval)
- [x] `runMultiAgentAnalysis()` public API wired to orchestrator
- [x] 15 unit tests (9 judge, 6 research brief)

## Phase 5.5: Cross-Signal Synthesizer
- [x] Implement cross-signal aggregation (pure computation)
- [x] Implement interaction classification
- [x] Implement LLM insights + holistic recommendations
- [x] Implement runPortfolioReview()
- [x] Test offsetting/compounding interactions

## Phase 6: Integration + Cache
- [x] Wire pipeline into server endpoints (SSE)
- [x] Implement CacheStore interface
- [ ] Implement follow-up query classification
- [ ] Wire cached artifacts into chat agent
- [x] Session CRUD endpoints

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
| Phase 0.5: Cleanup | 🔄 Partial | 4/10 |
| Phase 1: Foundation | ✅ Complete | 11/11 |
| Phase 2: Analysts | ✅ Complete | 4/4 |
| Phase 3: Debate | ✅ Complete | 5/5 |
| Phase 4: Risk Team | ✅ Complete | 4/4 |
| Phase 5: Synthesis | ✅ Complete | 15/15 |
| Phase 5.5: Cross-Signal | ✅ Complete | 5/5 |
| Phase 6: Integration | 🔄 Partial | 3/5 |
| Phase 7: Chat UI | ⬜ Not Started | 0/6 |
| Phase 8: Evaluation | ⬜ Not Started | 0/5 |
| Phase 9: Final Cleanup | ⬜ Not Started | 0/12 |
| Phase 10: Deployment | ⬜ Not Started | 0/5 |

**Tests:** 149/149 passing
- risk-profile-inference: 12
- calibration: 14
- market-data: 12
- portfolio-stress: 10
- magnitude-validator: 6
- debate-protocol: 6
- judge: 9
- research-brief: 6
- cross-signal-synthesizer: 13
- cache: 9
- (existing legacy tests: 52)
