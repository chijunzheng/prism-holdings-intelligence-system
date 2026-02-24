# Feature: Chat Panel — Contextual Right-Side Drawer

**ID:** 11
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 10

## Description

Build the Chat Panel as a right-side drawer that opens when the user clicks a node on the Causal Graph View. The chat is NOT a standalone chatbot — it's scoped to the selected node's context, pre-loaded with the full causal chain, exposure map, user profile, and source citations. Supports "Why?", "What if?", "What should I do?", "Show me the other side", and "How confident are you?" interaction patterns.

## Why This Matters

The Chat Panel is where users get personalized, actionable insight. The graph shows the structure; the chat explains the reasoning. The pre-loaded context eliminates the "cold start" problem of typical chatbots — the user doesn't have to explain their portfolio or the event. The "What if?" capability is particularly powerful: it lets users modify assumptions and see the graph re-render in real-time.

## Acceptance Criteria

- [ ] Opens as right-side drawer when graph node is clicked; graph remains visible on left (FR-9.1)
- [ ] Pre-loaded with context from selected node — first message summarizes the node's role
- [ ] Chat agent has access to: full causal chain, ExposureMap, user profile, temporal classification, source citations (FR-9.2)
- [ ] Supports "Why?" — explains causal reasoning for any link (FR-9.3)
- [ ] Supports "What if?" — modified assumptions re-render the Causal Graph (FR-9.3)
- [ ] Supports "What should I do?" — specific rebalancing options with tradeoffs (FR-9.3)
- [ ] Supports "Show me the other side" — contrarian case against its own analysis (FR-9.3)
- [ ] Supports "How confident are you?" — explains confidence and what would change it (FR-9.3)
- [ ] Cites sources for factual claims (FR-9.4)
- [ ] REFUSES definitive buy/sell recommendations — presents options only (FR-9.5)
- [ ] Resets and re-scopes when user clicks different node (FR-9.6)
- [ ] Regulatory disclaimer visible in chat panel

## Implementation Details

### Files to Create/Modify

- `frontend/src/components/chat/ChatPanel.tsx` — Drawer container
- `frontend/src/components/chat/ChatMessage.tsx` — Individual message bubble
- `frontend/src/components/chat/ChatInput.tsx` — User input with suggested prompts
- `frontend/src/components/chat/SuggestedPrompts.tsx` — Quick-tap prompt buttons
- `frontend/src/components/chat/SourceCitation.tsx` — Inline citation rendering
- `frontend/src/hooks/useChat.ts` — Chat state management and Gemini interaction
- `agents/chat-agent/index.ts` — Chat agent with context injection
- `agents/chat-agent/prompts.ts` — System prompt with behavioral constraints
- `agents/chat-agent/context-builder.ts` — Builds context payload from node + chain + profile
- `agents/chat-agent/__tests__/` — Test files

### Chat Agent System Prompt (Critical)

```
You are the Prism chat assistant. You help users understand how market events
affect their specific portfolio holdings.

CONTEXT:
- You have the full causal propagation chain for this event
- You have the user's true exposure map with dollar amounts
- You have the user's profile: [age, risk tolerance, goals, account types]
- You have the temporal classification and reasoning

BEHAVIORAL RULES:
1. NEVER give a definitive buy/sell recommendation. Always present OPTIONS with tradeoffs.
2. ALWAYS cite sources for factual claims using the provided citations.
3. ALWAYS reference the user's specific context (age, goals, risk tolerance) in recommendations.
4. When asked "What should I do?", present 2-3 options with clear tradeoffs.
5. When asked "Show me the other side", present the strongest contrarian case.
6. When confidence is low, say so explicitly.
7. NEVER suppress uncertainty. If you're not sure, say so.

DISCLAIMER: Include this in your first message: "This is educational analysis, not financial advice."
```

### Suggested Prompts

Pre-loaded buttons below the initial message:
- "Why does this affect my portfolio?"
- "What should I do?"
- "What if this is temporary?"
- "Show me the other side"
- "How confident is this analysis?"

### What-If Flow

When user asks "What if [modified assumption]?":
1. Chat agent extracts the modified assumption
2. Sends to Causal Propagation Engine (Feature 07) via orchestrator for re-generation
3. New CausalChain returned → dispatched to graph for re-render
4. Chat responds with summary of how the chain changed

### Technical Decisions

- **Streaming responses** — use Gemini streaming for responsive chat UX
- **Context injection, not RAG** — all context is structured and available; no retrieval needed
- **Suggested prompts as first-class UI** — most users won't type; they'll tap suggested prompts
- **Node-scoped context** — when node changes, conversation resets completely (no carry-over)

## Dependencies

### Depends On
- **Feature 10:** Causal Graph View dispatches node click events

### Blocks
- **Feature 12:** Orchestrator needs chat → what-if → graph re-render loop

## Testing Requirements

- [ ] Unit tests: ChatPanel renders with pre-loaded context message
- [ ] Unit tests: Suggested prompts render and trigger correct messages
- [ ] Unit tests: Panel resets when selected node changes
- [ ] Unit tests: Source citations render with links
- [ ] Unit tests: Chat refuses buy/sell recommendations (prompt test)
- [ ] Integration test: Node click → panel opens → send message → receive response
- [ ] Integration test: What-if question → chain re-generation → graph re-render
- [ ] Edge case: Gemini streaming error → graceful error message

## Implementation Checklist

- [ ] Build ChatPanel drawer component with slide-in animation
- [ ] Build ChatMessage component (user + assistant variants)
- [ ] Build ChatInput with send button
- [ ] Build SuggestedPrompts component
- [ ] Build SourceCitation component
- [ ] Create Chat Agent with system prompt and behavioral constraints
- [ ] Implement context-builder (node + chain + profile → context payload)
- [ ] Implement Gemini streaming integration
- [ ] Implement what-if flow (chat → orchestrator → re-generation → graph update)
- [ ] Implement node change → panel reset
- [ ] Wire node click events from CausalGraphView
- [ ] Add Disclaimer to panel
- [ ] Write tests (TDD)
- [ ] Test behavioral constraints (refuses buy/sell, cites sources, references user context)

## Notes

- The system prompt is the most important part. If it's not constrained properly, the chat will give definitive advice — which violates the regulatory boundary (PRD Section 5).
- Streaming responses are important for UX — a 3-5 second wait for a full response feels broken; streaming feels responsive.
- The what-if flow is the most complex interaction: it crosses the chat → orchestrator → agent → graph boundary. Test this path thoroughly.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** —
