# Feature: Page Narration Service + PrismNarration Component

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 01 (Signal cards restored so portfolio narration has signal context)
**Phase:** 2 — AI Narration Layer
**Plan Reference:** A1, B4

## Description

Prism generates **inline summary cards** embedded directly in each page — not in the chat drawer. Each page gets a 2-3 sentence narration explaining what the user is seeing in plain English. This is the foundation that transforms Prism from "chatbot in a drawer" to "AI that explains every page."

**Per-page narrations:**
- **Portfolio View:** "Your portfolio looks mostly healthy, but your 38% Canadian bank exposure could be affected by the BOC rate decision. Tap below to see more."
- **Signal Detail:** "This signal could cost you ~$340 this month. Your bond holdings (ZAG) are most exposed, while your bank stocks (ZEB) might benefit slightly."
- **Plan View:** "I found 5 options to offset this risk. A balanced response — adding 2 positions — could reduce your estimated loss by about 60%."
- **Playbook:** "You have 3 active plans covering 2 of your top 4 risk exposures. Your energy exposure has no plan yet."

## Acceptance Criteria

- [ ] New server endpoint `GET /api/narration/:userId/:page?signalId=...` returns narration text
- [ ] Backend uses existing `AskPrismContext` builder (Layer 1-3) with a focused narration prompt
- [ ] Narrations cached per userId/page/signalId with 5-min TTL
- [ ] New `<PrismNarration>` frontend component — styled card with Prism icon + text
- [ ] Shows skeleton loader while narration loads
- [ ] Placed above main content area on each page
- [ ] Optional CTA button(s) in the narration card
- [ ] Narrations are 2-3 sentences, plain English, no jargon, use dollar amounts
- [ ] Portfolio narration includes `topSignalId` and `estimatedImpactCad` for linking to insight card (A4)

## Implementation Details

### Files to Create

- `agents/src/chat-agent/narration.ts` — `generatePageNarration()` function
- `frontend/src/components/common/PrismNarration.tsx` — Narration card component
- `frontend/src/styles/prism-narration.css` — Styles
- `frontend/src/hooks/useNarration.ts` — Hook to fetch narration

### Files to Modify

- `server/src/index.ts` — New `/api/narration/:userId/:page` endpoint
- `frontend/src/routes/PortfolioView.tsx` — Add `<PrismNarration>`
- `frontend/src/routes/signals/SignalDetailPane.tsx` — Add `<PrismNarration>`
- `frontend/src/routes/signal/PlanView.tsx` — Add `<PrismNarration>`
- `frontend/src/routes/PlaybookView.tsx` — Add `<PrismNarration>`

### Backend: `generatePageNarration()`

```typescript
// agents/src/chat-agent/narration.ts
interface NarrationRequest {
  page: AskPrismPage
  context: AskPrismContext
}

interface NarrationResponse {
  narration: string
  topSignalId?: string
  estimatedImpactCad?: number
  suggestedAction?: string
  ctaLabel?: string
  ctaRoute?: string
}

export async function generatePageNarration(request: NarrationRequest): Promise<NarrationResponse>
```

- Reuses existing AskPrismContext assembly from `server/src/index.ts` (the progressive layer builder)
- Calls Gemini with a short, focused prompt per page type
- Cache: module-level `Map<string, { response, timestamp }>` with 5-min TTL, key = `narration:${userId}:${page}:${signalId}`

### Server Endpoint

```typescript
app.get('/api/narration/:userId/:page', async (req, res) => {
  const { userId, page } = req.params
  const { signalId } = req.query
  // Build AskPrismContext (reuse existing layer assembly)
  // Call generatePageNarration({ page, context })
  // Return NarrationResponse JSON
})
```

### Frontend: `<PrismNarration>`

```typescript
interface PrismNarrationProps {
  readonly userId: string
  readonly page: AskPrismPage
  readonly signalId?: string
  readonly className?: string
}
```

- Fetch on mount via `useNarration(userId, page, signalId)`
- Skeleton loader while loading (3-line text placeholder with Prism icon)
- Card design: subtle border, Prism sparkle icon, narration text, optional CTA button
- Error state: silently hide (narration is enhancement, not critical)

### Gemini Prompt (per page)

**Portfolio:** "You are Prism, an AI portfolio advisor. Given this portfolio context, write a 2-3 sentence summary for an everyday investor. Mention the biggest risk in dollar terms. No jargon. Be warm and direct."

**Signal Detail:** "Summarize how this signal affects the user's specific holdings. Use dollar amounts. Mention which holdings gain and which lose."

**Plan View:** "Summarize the available options to reduce this signal's impact. Mention how many candidates exist and what the best response could achieve."

**Playbook:** "Summarize the user's plan coverage. How many plans, which risks are covered, which are not."

## Dependencies

### Depends On
- **Feature 01:** Signal cards must be restored so portfolio narration has signal context to reference

### Blocks
- **Feature 08 (Plan Wizard):** Step 1 uses PrismNarration for signal impact summary
- **Feature 09 (Insight Card):** Uses narration endpoint's `topSignalId` + `estimatedImpactCad`

## Testing Requirements

- [ ] Unit test: `generatePageNarration()` returns valid NarrationResponse for each page type
- [ ] Unit test: Cache returns cached response within TTL
- [ ] Unit test: `<PrismNarration>` shows skeleton while loading, text when loaded
- [ ] Unit test: Error state hides component gracefully
- [ ] Integration test: Endpoint returns narration for portfolio page

## Implementation Checklist

- [ ] Create `agents/src/chat-agent/narration.ts` with `generatePageNarration()`
- [ ] Add narration prompts per page type
- [ ] Add caching with 5-min TTL
- [ ] Create server endpoint
- [ ] Create `useNarration` hook
- [ ] Create `<PrismNarration>` component with skeleton
- [ ] Create `prism-narration.css` styles
- [ ] Add to PortfolioView, SignalDetailPane, PlanView, PlaybookView
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
