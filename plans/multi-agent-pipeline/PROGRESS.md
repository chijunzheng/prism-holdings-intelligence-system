# Multi-Agent Pipeline — Progress Tracker

**Last Updated:** 2026-03-01 (Checkpoint & Thinking Visibility fixes)

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
- [x] Implement follow-up query classification
- [x] Wire cached artifacts into chat agent
- [x] Session CRUD endpoints

## Phase 7: Chat UI
- [x] Build left panel (holdings, sessions, expectations)
- [x] Build main chat area with message rendering
- [x] Build 9 rich card components + ChatCardRenderer dispatcher
- [x] Wire holdings interaction — `onHoldingClick` wired via ref pattern in ChatView
- [x] Wire checkpoint card UI components (CheckpointCard with chips + text input)
- [x] Session management (useSessions hook + SessionList panel)
- [x] **ChatArea calls `/api/v2/analyze` for signal analysis** (fixed in Phase 7.5)
- [x] **SSE consumption of pipeline stage events** (fixed in Phase 7.5)
- [ ] Checkpoint resume (`/api/v2/analyze/:threadId/resume`) — stub exists, needs thread ID tracking
- [x] **Signal detection via `useSignals` hook in ChatView** (fixed in Phase 7.5)

## Phase 8: Evaluation
- [x] Curate 25 historical events (8 rate, 4 CPI, 4 oil, 3 banking, 3 geopolitical, 3 FX)
- [x] Ground truth 5-day returns per ETF embedded in event files
- [x] Build eval harness with metrics (directional accuracy, range coverage, evidence grounding)
- [x] Single-agent baseline implementation
- [x] Console + markdown report generators

## Phase 9: Final Codebase Cleanup
- [x] Identify dead code via comprehensive codebase exploration
- [x] Delete orphaned frontend routes (6), components (20+), hooks (6), CSS (7)
- [x] Remove dead agent modules (alert-composer, personalization, strategy-*, agent.ts)
- [x] Remove dead server services (strategy, plan-copilot, plan-session, workspace-session)
- [x] Remove dead shared types (workspace.ts, plan-session.ts) and frontend workspace types
- [x] Clean up shared/src/index.ts exports (removed workspace, plan-session)
- [x] Clean up App.tsx — single ChatView route, no legacy routes
- [x] Remove dead server imports (plan-session-service, strategy-service, workspace-service, ADK)
- [x] Remove dead test files (29 tests removed with dead services)
- [x] Run full test suite — 232/232 pass
- [x] Line count: 58,787 → 41,673 (17,114 lines removed, 29% reduction)
- [ ] (Deferred) Full server/src/index.ts monolith refactoring — v1 orchestrator routes still wired

## Phase 7.5: Frontend-Pipeline Wiring (Critical Gap Fix)
- [x] Wire ChatArea to call `/api/v2/analyze` with `skipCheckpoints: true` for signal analysis
- [x] Consume SSE stream: parse stage events and render ThinkingCards, DebateSummaryCard, etc.
- [x] Map SSE `complete` event → render RecommendationCard + TransparencyCard + ResearchBriefCard
- [x] Load signals on mount via `useSignals` hook in ChatView
- [x] Render SignalCards in chat when signals are detected
- [x] Wire `onHoldingClick` to send holding context into chat
- [x] Fix ADK reference crash in server signals endpoint (guard `USE_ADK_ORCHESTRATION`)
- [x] Fix AnalyzeRequestSchema enum mismatch (urgency/sentiment) with Signal type
- [x] Add portfolio review flow (`/api/v2/analyze/portfolio`) wiring
- [x] Handle both cached JSON and SSE response formats

## Phase 10: GCP Deployment
- [ ] Dockerfiles
- [ ] Firestore setup
- [ ] Redis cache
- [ ] Deploy to Cloud Run
- [ ] Share URL

## Hotfix: Checkpoint & Thinking Visibility (2026-03-01)
**Issue:** User reported seeing nothing during pipeline execution — no checkpoints, no agent reasoning.
**Root Cause:** 5 compounding bugs in event timing, message enrichment, and UI rendering.
**Commit:** `b279ab3` — `fix: make checkpoints and agent thinking visible in pipeline UI`

### Bugs Fixed
1. **effectiveMode defaulting bug** (server/src/routes/analyze.ts:231)
   - Both ternary branches returned `'quick'` instead of `'quick'` and `'guided'`
   - Fix: `'quick' : 'guided'`

2. **Thinking text invisible due to timing** (frontend/src/components/panels/ChatArea.tsx)
   - SSE `agent_thinking` events arrive while target stage is still `pending`
   - PipelineProgressCard only renders thinking on `active` stages
   - Fix: Auto-promote `pending` → `active` in `updateThinkingText()` when thinking arrives
   - Also show thinking on both `active` AND `pending` in PipelineProgressCard

3. **No visible trail of agent reasoning** (frontend/src/components/panels/ChatArea.tsx)
   - No ThinkingCard display on stage completion
   - Fix: Insert ThinkingCard messages on substantive stage completion (analyst, debate, risk, verdict, judge)
   - Define `THINKING_CARD_STAGES` set; filter progress events; insert chat message when substantive

4. **onThinking messages too brief** (agents/src/**/*.ts)
   - "macro analyst analyzing..." vs "macro analyst: evaluating signal impact on your holdings..."
   - Fix: Enrich messages in run-analyst.ts, orchestrator.ts, debate-protocol.ts
   - Pattern: `<agent>: <what they're doing> — <why it matters>`

5. **summarizeNodeOutput messages generic** (agents/src/multi-agent/index.ts)
   - "4 specialist analysts completed assessments" → "4 analysts (macro, fundamental, sentiment, technical). Independent perspectives across all dimensions."
   - Fix: Add detail to all 8 node summaries (scale, key output, metrics)

6. **ThinkingCard CSS not prominent** (frontend/src/styles/chat-view.css)
   - Bland border design, hard to distinguish from chat
   - Fix: 3px left border (blue active, green complete), elevated background, better typography

### Files Changed
- `server/src/routes/analyze.ts` (1 line)
- `frontend/src/components/panels/ChatArea.tsx` (3 SSE handlers updated)
- `frontend/src/components/chat-cards/PipelineProgressCard.tsx` (1 line)
- `agents/src/multi-agent/index.ts` (enriched summarizeNodeOutput)
- `agents/src/multi-agent/analysts/run-analyst.ts` (enriched thinking messages)
- `agents/src/multi-agent/orchestrator.ts` (enriched thinking messages)
- `agents/src/multi-agent/researchers/debate-protocol.ts` (enriched debate messages)
- `frontend/src/styles/chat-view.css` (redesigned ThinkingCard)

### Verification
- ✅ `pnpm -w build` passes (frontend + shared clean)
- ✅ No new type errors in agents/server
- ✅ All 8 files type-check correctly

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
| Phase 6: Integration | ✅ Complete | 5/5 |
| Phase 7: Chat UI | ✅ Complete | 9/10 (1 deferred: checkpoint resume) |
| Phase 7.5: FE-Pipeline Wiring | ✅ Complete | 10/10 |
| Phase 8: Evaluation | ✅ Complete | 5/5 |
| Phase 9: Final Cleanup | ✅ Complete | 11/12 |
| Phase 10: Deployment | ⬜ Not Started | 0/5 |

**Tests:** 232/232 passing (29 removed with dead code)
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
- follow-up-router: 14
- (existing legacy tests: 52)
