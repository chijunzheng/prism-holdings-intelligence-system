# Feature 01: Unified Ask Prism Chat Context (Backend)

## Implementation Summary

**Date:** 2026-02-26
**Status:** ✅ Completed

## What Was Built

### 1. New Types (`shared/src/types/ask-prism.ts`)
- **AskPrismTemporalAnalysis** — Lightweight temporal analysis interface matching agent's TemporalAnalysis structure but with simplified types
- **PlanSelection** — User's selection of strategy candidate with allocation percentage
- **AskPrismContext** — Unified context with 3 progressive layers:
  - Layer 1 (always): profile, holdings, exposureMap, activeSignals
  - Layer 2 (signal page): focusedSignal, causalChain, temporalAnalysis
  - Layer 3 (plan page): strategyCandidates, currentPlan, evaluation
- **AskPrismPage** — Type for page identifier: 'portfolio' | 'signal' | 'plan'

### 2. Unified Prompt Builder (`agents/src/chat-agent/ask-prism-prompt.ts`)
- **buildAskPrismPrompt()** — Formats all available context layers into comprehensive, human-readable prompt
- Includes behavioral rules from existing buildSystemPrompt()
- Formats holdings as readable list with weights and dollar values
- Shows complete exposure breakdown with contributing holdings
- Includes concentration warnings and overlaps
- Active signals with headline, urgency, sentiment, and affected exposures
- Signal detail: full causal chain with nodes, edges, mechanisms, temporal buckets
- Plan context: candidates, current selections, evaluation metrics

### 3. New Chat Function (`agents/src/chat-agent/index.ts`)
- **streamAskPrismResponse()** — Async generator streaming function
- Takes AskPrismContext, history, userMessage
- Uses runPrismAdkPrompt with unified prompt
- Returns text chunks (same pattern as existing streaming functions)
- Session ID: `ask-prism:{userId}`

### 4. New API Endpoint (`server/src/index.ts`)
- **POST /api/chat/:userId/ask-prism**
- Request body:
  - page: 'portfolio' | 'signal' | 'plan'
  - signalId?: string
  - planSelections?: PlanSelection[]
  - message: string
  - history?: ChatMessage[]
- Loads user data: portfolio, profile, exposure map, signals
- Conditionally loads signal detail if page is 'signal' or 'plan' and signalId provided
- Uses orchestrator's cached functions: runExposureAnalysis, runSignalMonitor, runGraphPipeline
- Streams via SSE (Server-Sent Events) with format: `data: {"text":"chunk"}\n\n`
- Properly handles errors with try/catch

### 5. Export Updates (`shared/src/index.ts`)
- Added `export * from './types/ask-prism'`

## Key Design Decisions

### Progressive Context Disclosure
The unified context supports three layers that progressively add detail:
1. **Portfolio View** — Base context with all holdings, exposures, warnings, and active signals
2. **Signal Detail View** — Adds focused signal, causal chain, temporal analysis
3. **Plan View** — Adds strategy candidates, user selections, evaluation

### Immutability
All interfaces use `readonly` arrays and properties following the codebase's immutability pattern.

### No Mutation
The endpoint builds context using Object.assign() conditionally but always creates new objects, never mutates existing ones.

### Error Handling
Comprehensive error handling with try/catch block that catches any unhandled errors and returns proper HTTP 500 responses with error messages.

### Caching Strategy
Leverages orchestrator's existing caching infrastructure:
- exposureCache (permanent for session)
- signalCache (15min TTL for non-empty, 1min for empty)
- causalChainCache (30min TTL)
- In-flight request deduplication via exposureInFlight, signalInFlight, chainInFlight

### Streaming Pattern
Uses the same SSE streaming pattern as existing chat endpoints:
- Content-Type: text/event-stream
- Cache-Control: no-cache
- Connection: keep-alive
- Data format: `data: {"text":"chunk"}\n\n`
- Completion marker: `data: [DONE]\n\n`

## What Was NOT Modified

- **Existing chat functions** — streamGeneralChatResponse, streamChatResponse, generateInitialMessage remain unchanged
- **buildSystemPrompt** — Imported and reused, not modified
- **Node-scoped chat** — Still works via existing endpoints for graph node context
- **Orchestrator caching** — No changes to cache logic, just using existing functions

## Testing Checklist

- [ ] Portfolio page: Load with Layer 1 context only (profile, holdings, exposures, signals)
- [ ] Signal page: Load with Layer 1 + 2 (add signal detail, causal chain, temporal)
- [ ] Plan page: Load with Layer 1 + 2 + 3 (add candidates, selections, evaluation)
- [ ] Streaming: Verify SSE chunks arrive correctly
- [ ] Error handling: Test with invalid userId, missing signalId, etc.
- [ ] Cache behavior: Verify signals/chains are cached and reused
- [ ] Message history: Verify conversation context persists across turns
- [ ] Prompt quality: Check that all context layers appear correctly in responses

## Technical Debt / Future Work

### Layer 3 (Plan Context) Not Fully Integrated
The endpoint includes a placeholder for plan context but doesn't fully integrate with the strategy service. When implementing the frontend for Layer 3, need to:
- Load strategyCandidates from strategy service
- Load evaluation from strategy service when plan selections provided
- Pass signalId to strategy service for signal-aware candidate generation

### No Initial Message Generation
Unlike the general chat endpoints, this unified endpoint doesn't have a separate `/init` endpoint. The frontend will need to either:
- Send an empty/placeholder first message to trigger initial context explanation, or
- Add a separate `/api/chat/:userId/ask-prism/init` endpoint later

### Session Management
The session ID is currently just `ask-prism:{userId}`, which means all pages share the same conversation history. Consider:
- Using page-specific session IDs: `ask-prism:{userId}:{page}`
- Or signal-specific: `ask-prism:{userId}:signal:{signalId}`
- Or keeping unified history across all pages (current approach)

### Prompt Length
The unified prompt can be quite long (especially with Layer 2 + 3). If context window becomes an issue:
- Consider summarizing less critical details
- Use a sliding window for chat history
- Implement prompt compression strategies

## Files Created

1. `/shared/src/types/ask-prism.ts` — 60 lines
2. `/agents/src/chat-agent/ask-prism-prompt.ts` — 232 lines

## Files Modified

1. `/shared/src/index.ts` — Added export for ask-prism types
2. `/agents/src/chat-agent/index.ts` — Added streamAskPrismResponse function
3. `/server/src/index.ts` — Added import and new endpoint

## Total Lines Added

Approximately 400 lines of new code (excluding blank lines and comments).
