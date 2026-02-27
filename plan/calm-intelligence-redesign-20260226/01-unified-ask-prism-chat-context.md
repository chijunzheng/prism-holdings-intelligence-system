# Feature: Unified Ask Prism Chat Context (Backend)

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Create a single layered context system for Ask Prism that provides full portfolio awareness on every page. Replace the split between general chat (top-5 exposures only) and node-scoped chat with one unified endpoint.

Currently there are two separate chat paths:
1. **Node-scoped** (`streamChatResponse`) — rich context (signal, chain, node, exposures, temporal) but only for graph nodes
2. **General** (`streamGeneralChatResponse`) — only top-5 exposures and profile. Cannot answer overlap questions, doesn't know about active signals.

The new system uses layered context that adds more information based on which page the user is on.

## Acceptance Criteria

- [ ] Ask Prism on Portfolio page can answer "what's my overlap between XIC and ZEB?" using full exposure data
- [ ] Ask Prism on Signal Detail page has full causal chain + temporal analysis context
- [ ] Ask Prism on Plan page knows current candidate selections and evaluation scores
- [ ] Existing node-scoped chat for graph node bottom sheets still works (kept separate)
- [ ] What-if detection still routes correctly
- [ ] Streaming SSE responses work on all pages

## Implementation Details

### Files to Create

- `shared/src/types/ask-prism.ts` — `AskPrismContext` interface with 3 layers
- `agents/src/chat-agent/ask-prism-prompt.ts` — unified prompt builder

### Files to Modify

- `agents/src/chat-agent/index.ts` — add `streamAskPrismResponse()` function
- `agents/src/chat-agent/prompts.ts` — update `buildSystemPrompt` to accept full holdings/exposure data
- `server/src/index.ts` — add `POST /api/chat/:userId/ask-prism` endpoint
- `shared/src/types/index.ts` — export new types

### Key Components

1. **`AskPrismContext` Interface**
   ```typescript
   interface AskPrismContext {
     // Layer 1 — always present (Portfolio page and above)
     readonly profile: UserProfile
     readonly holdings: ReadonlyArray<Holding>
     readonly exposureMap: ExposureMap          // full, not top-5
     readonly activeSignals: ReadonlyArray<Signal>

     // Layer 2 — Signal Detail page
     readonly focusedSignal?: Signal
     readonly causalChain?: CausalChain
     readonly temporalAnalysis?: TemporalAnalysis

     // Layer 3 — Plan page
     readonly strategyCandidates?: ReadonlyArray<StrategyCandidate>
     readonly currentPlan?: ReadonlyArray<PlanSelection>
     readonly evaluation?: StrategyEvaluation
   }
   ```

2. **Unified Prompt Builder**
   - Formats all available layers into the system prompt
   - Layer 1: Profile + full holdings with weights + all exposures + concentration warnings + overlap data + active signals summaries
   - Layer 2: Adds focused signal details, full causal chain with edges/mechanisms, temporal buckets, counterfactual
   - Layer 3: Adds strategy candidates with rationale, user's current plan selections, evaluation metrics

3. **Server Endpoint**
   - `POST /api/chat/:userId/ask-prism`
   - Request body: `{ page: 'portfolio' | 'signal' | 'plan', signalId?: string, planSelections?: array, message: string, history: ChatMessage[] }`
   - Assembles context from cached orchestrator data (signals 15min cache, chains 30min cache)
   - Streams response via SSE

### Technical Decisions

- **Keep node-scoped chat separate:** The graph node bottom sheet chat is a different UX (scoped to one node, not free-form). Keep existing endpoints for that.
- **Context assembly on server:** Frontend sends page + IDs, server pulls cached data. This avoids sending large context objects from frontend.
- **Full exposure map in prompt:** Include all sectors, not top-5. The LLM needs this to answer overlap/concentration questions accurately.

## Dependencies

### Depends On
- None — can be built first

### Blocks
- **Feature 05:** Ask Prism frontend upgrade needs this endpoint

## Testing Requirements

- [ ] Unit tests: prompt builder produces correct output for each layer combination
- [ ] Unit tests: context assembly pulls correct cached data
- [ ] Integration tests: SSE streaming works end-to-end
- [ ] Integration tests: Layer 1 only (portfolio page) returns useful answers about overlaps
- [ ] Integration tests: Layer 1+2 (signal page) references causal chain in answers
- [ ] Integration tests: Layer 1+2+3 (plan page) references evaluation scores

## Security Considerations

- [ ] Input validation on `page`, `signalId`, `planSelections` fields
- [ ] User ID validation (user can only access their own data)
- [ ] No raw portfolio data in SSE response (only LLM-generated text)

## Implementation Checklist

- [ ] Create `AskPrismContext` interface in shared types
- [ ] Create unified prompt builder with layered formatting
- [ ] Create `streamAskPrismResponse` in chat-agent
- [ ] Create server endpoint with context assembly from cache
- [ ] Write tests
- [ ] Verify streaming works
- [ ] Verify backward compatibility (old endpoints still work for node-scoped chat)

## Notes

- The existing `buildSystemPrompt` in `prompts.ts` already includes user profile. The new version extends this with holdings and exposure data.
- Orchestrator cache keys: signals `cache:signals:{userId}`, chains `cache:graph:{userId}:{signalId}`. Reuse these.
- Max context size consideration: full exposure map + all signals + causal chain could be large. May need to summarize if token limits are hit.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
