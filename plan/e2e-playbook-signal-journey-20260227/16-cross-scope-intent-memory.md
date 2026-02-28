# Feature: Cross-Scope Intent Memory

**ID:** 16
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** None
**Phase:** 4 — Navigating Copilot
**Plan References:** A8, B5

## Description

Each Ask Prism scope (portfolio, signal, plan) has its own thread. When the user says "I'm worried about tech" on the portfolio page and then navigates to a signal, Prism has no memory of that concern.

Maintain a lightweight `userIntentSummary` that persists across scopes within a session, stored in `sessionStorage`.

## Acceptance Criteria

- [ ] `userIntentSummary: string[]` added to AppContext (max 5 items)
- [ ] After each user message, extract key intents via heuristic or lightweight LLM call
- [ ] Intents persist across page navigation via `sessionStorage`
- [ ] Intents passed into `AskPrismContext` as `userIntents` field
- [ ] Ask Prism prompt includes "USER PREFERENCES" section with intents
- [ ] Cleared on tab close (sessionStorage behavior)
- [ ] Prism references earlier concerns naturally: "You mentioned being worried about tech exposure..."

## Implementation Details

### Files to Modify

- `frontend/src/contexts/AppContext.tsx` — Add `userIntentSummary` state + sessionStorage
- `shared/src/types/ask-prism.ts` — Add `userIntents?: string[]` to `AskPrismContext`
- `agents/src/chat-agent/ask-prism-prompt.ts` — Add USER PREFERENCES section
- `frontend/src/hooks/useChat.ts` — Extract intents after each message
- `server/src/index.ts` — Pass userIntents from request body into context

### Intent Extraction (Heuristic)

```typescript
const CONCERN_KEYWORDS = ['worried', 'concerned', 'focus on', 'avoid', 'scared', 'nervous', 'risk']

function extractIntent(userMessage: string): string | null {
  const lower = userMessage.toLowerCase()
  const hasConcern = CONCERN_KEYWORDS.some(k => lower.includes(k))
  if (!hasConcern) return null

  // Extract the topic after the concern keyword
  // "I'm worried about tech exposure" → "Concerned about tech exposure"
  return `User concerned about: ${extractTopic(userMessage)}`
}
```

### AppContext Integration

```typescript
// State
const [userIntentSummary, setUserIntentSummary] = useState<ReadonlyArray<string>>(() => {
  const stored = sessionStorage.getItem('prism-user-intents')
  return stored ? JSON.parse(stored) : []
})

// Persist on change
useEffect(() => {
  sessionStorage.setItem('prism-user-intents', JSON.stringify(userIntentSummary))
}, [userIntentSummary])

// Add intent (max 5, FIFO)
const addUserIntent = (intent: string) => {
  setUserIntentSummary(prev => {
    const updated = [...prev, intent]
    return updated.length > 5 ? updated.slice(-5) : updated
  })
}
```

### Ask Prism Prompt Addition

```
## USER PREFERENCES (from earlier in this session)
${userIntents.map(i => `- ${i}`).join('\n')}

When relevant, acknowledge the user's earlier concerns naturally.
```

## Testing Requirements

- [ ] Unit test: Intent extraction identifies concern keywords
- [ ] Unit test: Max 5 intents maintained (FIFO)
- [ ] Unit test: sessionStorage persistence works
- [ ] Unit test: Intents included in AskPrismContext

## Implementation Checklist

- [ ] Add `userIntentSummary` to AppContext with sessionStorage
- [ ] Add `userIntents` to AskPrismContext type
- [ ] Implement intent extraction heuristic
- [ ] Hook into useAskPrismChat to extract after each message
- [ ] Pass intents to server in ask-prism request body
- [ ] Add USER PREFERENCES section to Ask Prism prompt
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
