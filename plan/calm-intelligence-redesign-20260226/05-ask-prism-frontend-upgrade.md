# Feature: Ask Prism Slide-Over Frontend Upgrade

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** 01 (Unified Ask Prism Chat Context)

## Description

Update the Ask Prism drawer frontend to pass current page context to the new unified `/api/chat/:userId/ask-prism` endpoint, with page-specific suggested prompts. Ensure conversation state persists across page navigation.

Currently `AskPrismDrawer.tsx` uses the general chat endpoint which only has top-5 exposure context. This feature wires it to the new unified endpoint and adds contextual prompt suggestions.

## Acceptance Criteria

- [ ] Ask Prism detects current page (portfolio, signal detail, plan) and passes to unified endpoint
- [ ] Suggested prompt chips change per page:
  - Portfolio: "What's my biggest risk?", "Explain my overlaps", "Compare my signals"
  - Signal Detail: "What if this reverses?", "How confident is this?", "Show the other side"
  - Plan: "Why does this help?", "What are the risks?", "What am I missing?"
- [ ] Conversation persists when navigating between pages (don't reset on route change)
- [ ] Chat responses reference page-specific context (e.g., mentions causal chain on Signal Detail)
- [ ] Streaming SSE still works correctly

## Implementation Details

### Files to Modify

- `frontend/src/components/portfolio/AskPrismDrawer.tsx` — detect route, pass page context, update suggested prompts
- `frontend/src/hooks/useChat.ts` — call new `/api/chat/:userId/ask-prism` endpoint instead of general/scoped endpoints

### Files to Create

- `frontend/src/hooks/usePageContext.ts` — hook that returns current page identifier + relevant IDs from route params

### Key Components

1. **`usePageContext.ts`** — Route detection hook
   - Uses `useLocation` and `useParams` from React Router
   - Returns: `{ page: 'portfolio' | 'signal' | 'plan', signalId?: string }`
   - Portfolio: path is `/` or `/portfolio`
   - Signal Detail: path matches `/signals/:signalId`
   - Plan: path matches `/signals/:signalId/plan`

2. **Updated `AskPrismDrawer.tsx`**
   - Uses `usePageContext` to get current page
   - Passes page + IDs to chat hook
   - Renders different suggested prompt chips based on page
   - Conversation state (messages array) lives in a ref/context that survives route changes

3. **Updated `useChat.ts`**
   - New function: `sendAskPrismMessage(page, signalId?, planSelections?, message, history)`
   - Calls `POST /api/chat/:userId/ask-prism` with page context
   - Handles SSE streaming (reuse existing streaming logic)
   - Deprecate: direct calls to `/api/chat/:userId/general/*`

### Technical Decisions

- **Conversation persistence:** Store chat messages in a React context or zustand store that lives above the router. Route changes don't unmount the conversation.
- **Page context sent per message:** Each message includes the current page context. If user navigates from Signal Detail to Plan mid-conversation, the next message gets Plan context. This is intentional — the LLM should be aware of where the user is now.
- **Plan selections from parent:** On Plan page, the `usePlan` hook's current selections need to be accessible to Ask Prism. Pass via context or prop drilling.

## Dependencies

### Depends On
- **Feature 01:** Unified Chat Context backend endpoint must exist

### Blocks
- **Feature 06:** Cleanup — old chat endpoints can't be removed until this is wired up

## Testing Requirements

- [ ] Unit tests: usePageContext returns correct page for each route
- [ ] Unit tests: suggested prompts change per page
- [ ] Integration tests: chat messages include correct page context
- [ ] Integration tests: conversation persists across route navigation
- [ ] E2E test: open Ask Prism on Portfolio → ask question → navigate to Signal Detail → ask follow-up → context is appropriate

## Security Considerations

- [ ] No new security concerns — same authentication as existing chat

## Implementation Checklist

- [ ] Create usePageContext hook
- [ ] Update useChat to call new unified endpoint
- [ ] Update AskPrismDrawer with page-specific suggested prompts
- [ ] Add conversation persistence across routes
- [ ] Wire plan selections to Ask Prism context on Plan page
- [ ] Write tests
- [ ] Verify streaming still works

## Notes

- The Ask Prism FAB button and slide-over animation stay exactly as they are. Only the data flow and suggested prompts change.
- Consider: when user opens Ask Prism on Signal Detail, pre-populate a system message like "You're looking at [signal name]. How can I help?" — this gives the user confirmation that Prism is aware of their context.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
