# Feature: Orchestrator & End-to-End Demo Flow

**ID:** 12
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 06, 09, 10, 11

## Description

Build the Google ADK Orchestrator that coordinates all agent execution, routes user interactions (what-if scenarios) back to the appropriate agent, and wire the complete end-to-end demo flow from Portfolio View → Signal Detection → Causal Graph → Chat → What-if re-render. This is the integration layer that makes all features work together as one system.

## Why This Matters

Individual features are meaningless without orchestration. The demo flow must feel seamless: the user opens the app, sees their exposure, a live signal appears, they tap through to the graph, click a node, ask a question, modify an assumption, and watch the graph re-render — all without friction. The Orchestrator makes this pipeline execute in the right order with proper data handoffs.

## Acceptance Criteria

- [ ] Orchestrator coordinates agent execution: Exposure → Signal → Causal → Temporal → Alert pipeline
- [ ] Portfolio View load triggers: Exposure Analyzer → Signal Monitor (with ExposureMap) → display results
- [ ] Signal card tap triggers: fetch/generate CausalChain → Temporal analysis → navigate to graph
- [ ] Node click triggers: build chat context → open Chat Panel
- [ ] What-if from chat triggers: re-run Causal Propagation Engine with modified assumptions → re-render graph
- [ ] User profile switching updates all agent outputs (personalization contrast demo)
- [ ] Loading states shown during async LLM calls (signal detection, chain generation, chat responses)
- [ ] Error handling: graceful fallbacks when any agent fails
- [ ] Full demo flow completes in <30 seconds from signal detection to graph render
- [ ] All 3 demo personas produce visibly different results for same market event

## Implementation Details

### Files to Create/Modify

- `agents/orchestrator/index.ts` — Main orchestrator (Google ADK)
- `agents/orchestrator/pipeline.ts` — Agent pipeline coordination
- `agents/orchestrator/routes.ts` — Routes user interactions to correct agent
- `agents/orchestrator/error-handling.ts` — Graceful degradation
- `frontend/src/services/orchestrator-client.ts` — Frontend client for orchestrator
- `frontend/src/hooks/useOrchestrator.ts` — React hook for pipeline state
- `frontend/src/components/shared/LoadingStates.tsx` — Loading indicators per stage
- `frontend/src/components/shared/ErrorBoundary.tsx` — Error UI
- `frontend/src/contexts/AppContext.tsx` — Global app state (selected user, active signals)

### Pipeline Sequences

**On Portfolio View Load:**
```
1. Load user profile + portfolio (from sample data)
2. Run Exposure Analyzer → ExposureMap
3. Render Portfolio View with X-Ray
4. Run Signal Monitor (Gemini search grounding, scoped to ExposureMap) → signals
5. Run Alert Composer (personalize + filter) → formatted alerts
6. Render Signal Cards (with loading state during steps 4-5)
```

**On Signal Card Tap:**
```
1. Get signal from state
2. Run Causal Propagation Engine (signal + ExposureMap) → CausalChain
3. Run Temporal Reasoner (chain + user profile) → TemporalAnalysis
4. Navigate to /graph/:signalId with chain + analysis data
5. Render graph (with loading state during steps 2-3)
```

**On What-If from Chat:**
```
1. Chat agent extracts modified assumption
2. Orchestrator routes to Causal Propagation Engine with modified event
3. New CausalChain generated
4. Run Temporal Reasoner on new chain
5. Dispatch updated chain to graph → re-render with transitions
6. Chat responds with summary of changes
```

### User Profile Switching (Demo Feature)

A profile switcher in the app header allows toggling between demo personas:
- Switching profiles re-runs the full pipeline with the new profile's portfolio and context
- Same market events → different concentration warnings, different signal materiality, different recommendations
- This is the "FR-5.4" proof: same event, different users, different intelligence

### Loading States

| Stage | Loading Message | Expected Duration |
|-------|----------------|-------------------|
| Exposure Analysis | "Analyzing your holdings..." | <1s (no LLM) |
| Signal Detection | "Scanning for relevant market events..." | 3-8s (Gemini search) |
| Causal Chain | "Tracing impact to your portfolio..." | 5-10s (Gemini reasoning) |
| Temporal Analysis | "Classifying time horizons..." | 3-5s (Gemini) |
| Chat Response | Streaming indicator | Streamed |

### Error Handling Strategy

| Failure | Fallback |
|---------|----------|
| Signal Monitor returns no results | Show "No material events detected" with monitoring status |
| Causal chain generation fails | Show error with "Retry" button; log for debugging |
| Temporal classification fails | Show chain without classification; note "analysis pending" |
| Chat agent fails | Show error message with retry; don't crash the graph |

### Technical Decisions

- **Google ADK orchestration** — use ADK's built-in agent coordination, not custom event system
- **Caching** — cache ExposureMap (doesn't change), cache signals (5-min TTL), don't cache chains (they're per-signal)
- **Loading states are first-class UI** — LLM calls take seconds; empty screens feel broken
- **Profile switching is a dev/demo tool** — would not exist in production (each user sees only their own profile)

## Dependencies

### Depends On
- **Feature 06:** Signal Cards rendered and tappable
- **Feature 09:** Alert Composer formats and personalizes alerts
- **Feature 10:** Causal Graph View renders chains
- **Feature 11:** Chat Panel with what-if flow

## Testing Requirements

- [ ] Integration test: Full pipeline from load → exposure → signals → cards renders
- [ ] Integration test: Card tap → chain generation → graph render
- [ ] Integration test: Node click → chat opens with context
- [ ] Integration test: What-if → re-generation → graph re-render
- [ ] Integration test: Profile switch → all outputs update
- [ ] Unit tests: Loading states appear and dismiss at correct stages
- [ ] Unit tests: Error handling shows fallback UI per failure type
- [ ] Performance test: Full demo flow completes in <30 seconds
- [ ] Edge case: Network failure mid-pipeline → graceful error

## Implementation Checklist

- [ ] Build Google ADK orchestrator with agent pipeline
- [ ] Implement portfolio load sequence
- [ ] Implement signal card tap sequence
- [ ] Implement what-if re-generation routing
- [ ] Build frontend orchestrator client
- [ ] Build useOrchestrator hook with pipeline state
- [ ] Build loading state components
- [ ] Build error boundary and fallback UI
- [ ] Build profile switcher (demo tool)
- [ ] Build AppContext for global state
- [ ] Implement caching strategy
- [ ] Wire all features together end-to-end
- [ ] Write integration tests for all pipeline sequences
- [ ] Performance test full demo flow
- [ ] Run through complete demo flow 5+ times with different live signals

## Notes

- **This is the make-or-break integration.** Individual features can be perfect, but if the orchestration is slow, buggy, or has poor loading states, the demo fails.
- Test with real Gemini calls early — don't wait until all features are done. Mock the pipeline shape, then swap in real agents incrementally.
- The profile switcher is the easiest way to demonstrate personalization. Build it as a simple dropdown, not a fancy UI.
- Consider a "demo mode" flag that pre-warms caches (runs signal detection on app start rather than waiting for page load) for smoother live demos.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** —
