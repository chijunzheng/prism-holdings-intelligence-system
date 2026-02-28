# Feature: Proactive Insight Card on Portfolio View

**ID:** 09
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 05 (Page Narration provides the insight content)
**Phase:** 3 — Conversational Planning
**Plan Reference:** A4

## Description

Prism proactively surfaces the most important insight at the top of the Portfolio View. A single "Prism Insight" card between IntelligenceBriefing and holdings that says something like: "Heads up — the BOC rate decision could cost you ~$340 this month. Your bond and bank holdings are most affected."

Two CTA buttons: "Show me more →" (navigates to signal detail) | "Help me plan" (navigates to plan builder).

## Acceptance Criteria

- [ ] Insight card appears at top of portfolio when a high-impact signal exists
- [ ] Only shows for signals with estimated impact > $100 (configurable threshold)
- [ ] Max 1 insight card at a time (highest impact signal)
- [ ] "Show me more" navigates to signal detail via React Router
- [ ] "Help me plan" navigates to plan builder via React Router
- [ ] "Got it" dismissal hides it for 24 hours (localStorage)
- [ ] If no signal above threshold, card is not rendered
- [ ] Uses narration from Feature 05's endpoint (the `portfolio` page narration)

## Implementation Details

### Files to Create

- `frontend/src/components/portfolio/PrismInsightCard.tsx` — The insight card component
- `frontend/src/styles/prism-insight.css` — Styles

### Files to Modify

- `frontend/src/routes/PortfolioView.tsx` — Add `<PrismInsightCard>` between IntelligenceBriefing and holdings

### PrismInsightCard Component

```typescript
interface PrismInsightCardProps {
  readonly narration: string
  readonly topSignalId: string
  readonly estimatedImpactCad: number
  readonly impactThreshold?: number   // default 100
}
```

**Logic:**
```typescript
const dismissKey = `prism-insight-dismissed:${topSignalId}`
const dismissedAt = localStorage.getItem(dismissKey)
const isDismissed = dismissedAt && (Date.now() - Number(dismissedAt)) < 24 * 60 * 60 * 1000
const isAboveThreshold = estimatedImpactCad > (impactThreshold ?? 100)

if (isDismissed || !isAboveThreshold) return null
```

**Dismiss handler:**
```typescript
const handleDismiss = () => {
  localStorage.setItem(dismissKey, String(Date.now()))
  setVisible(false)
}
```

### Integration with Narration Endpoint

The `GET /api/narration/:userId/portfolio` endpoint (Feature 05) returns:
```typescript
{
  narration: string
  topSignalId?: string
  estimatedImpactCad?: number
  suggestedAction?: string
}
```

`PortfolioView` fetches narration via `useNarration(userId, 'portfolio')`, then conditionally renders `<PrismInsightCard>` if `topSignalId` and `estimatedImpactCad` are present.

### Visual Design

- Subtle elevated card with left border accent (Prism brand color)
- Prism sparkle icon top-left
- Narration text (2-3 sentences)
- Two pill buttons: "Show me more →" and "Help me plan →"
- "Got it" dismiss link (subtle, top-right)
- Fade-in animation on mount

## Dependencies

### Depends On
- **Feature 05:** Narration endpoint provides the insight content, topSignalId, and estimatedImpactCad

## Testing Requirements

- [ ] Unit test: Card renders when signal above threshold
- [ ] Unit test: Card hidden when signal below threshold
- [ ] Unit test: Dismissal persists to localStorage
- [ ] Unit test: Card re-appears after 24 hours
- [ ] Unit test: Navigation buttons link to correct routes

## Implementation Checklist

- [ ] Create `PrismInsightCard` component
- [ ] Create CSS styles
- [ ] Add dismissal logic with localStorage
- [ ] Integrate into PortfolioView
- [ ] Wire to narration hook data
- [ ] Write unit tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
