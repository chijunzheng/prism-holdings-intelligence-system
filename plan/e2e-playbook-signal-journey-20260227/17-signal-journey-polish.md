# Feature: Signal Journey Polish (Stories, Covered Indicator, Sticky CTA)

**ID:** 17
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 01 (Signal cards restored), 03 (Resume plan indicator)
**Phase:** 5 — Polish & Lifecycle
**Plan References:** J1, J2, J3, J6

## Description

Polish the signal discovery and detail experience:

1. **J1 — Signal Cards as Stories:** Reframe signal cards as questions: "How does the BOC rate decision affect your portfolio?" + dollar impact + urgency label (Act soon / Watch / Low priority).

2. **J2 — Portfolio Health as Entry Point:** Make health grade clickable → navigates to signals filtered by severity.

3. **J3 — "You're Covered" Indicator:** Shield/checkmark icon on signal cards that have a reviewed plan.

4. **J6 — Sticky "What Can I Do?" CTA:** Always visible at bottom of signal detail viewport. Text changes based on context: "What can I do?" / "Review your plan" / "Low impact — no action needed."

## Acceptance Criteria

- [ ] Signal cards reframed as questions with urgency labels
- [ ] Each signal card shows "Act soon" / "Watch" / "Low priority" based on materiality
- [ ] Signal cards with reviewed plans show a shield/checkmark overlay
- [ ] Health grade on Portfolio View is clickable → navigates to signals page
- [ ] Sticky CTA at bottom of signal detail view
- [ ] CTA text changes: no plan → "What can I do?" / has plan → "Review your plan" / low impact → "Low impact"

## Implementation Details

### Files to Modify

- `frontend/src/components/portfolio/SignalCardsSection.tsx` — Story-style cards + urgency labels + covered indicator
- `frontend/src/components/portfolio/IntelligenceBriefing.tsx` — Clickable health grade
- `frontend/src/routes/signals/SignalDetailPane.tsx` — Sticky CTA
- `frontend/src/styles/portfolio.css` — Updated card styles
- `frontend/src/styles/signal-detail.css` — Sticky CTA styles

### J1: Signal Cards as Stories

Transform card headline from: "BOC Rate Decision" to: "How does the BOC rate decision affect your portfolio?"

Add urgency badge using existing `getMateriality()`:
```typescript
const urgency = materiality === 'high' ? 'Act soon' : materiality === 'medium' ? 'Watch' : 'Low priority'
```

### J3: Covered Indicator

Check if a reviewed plan exists for this signal (leverage Feature 03's `useExistingPlanSession` hook):
```tsx
{hasReviewedPlan && (
  <span className="signal-card__covered-badge" title="You have a plan for this">
    ✓ Covered
  </span>
)}
```

### J6: Sticky CTA

```tsx
<div className="signal-detail__sticky-cta">
  {hasPlan ? (
    <Link to={`/signals/${signalId}/plan?sessionId=${sessionId}`}>
      Review your plan →
    </Link>
  ) : lowImpact ? (
    <span>Low impact — no action needed</span>
  ) : (
    <Link to={`/signals/${signalId}/plan`}>
      What can I do about this? →
    </Link>
  )}
</div>
```

CSS: `position: sticky; bottom: 0;` with a frosted glass backdrop.

## Testing Requirements

- [ ] Unit test: Signal cards show question-format headlines
- [ ] Unit test: Urgency labels match materiality
- [ ] Unit test: Covered indicator shows when reviewed plan exists
- [ ] Unit test: Health grade is a clickable link
- [ ] Unit test: Sticky CTA shows correct text based on plan state

## Implementation Checklist

- [ ] Reframe signal card headlines as questions
- [ ] Add urgency badge to cards
- [ ] Add covered indicator with plan check
- [ ] Make health grade clickable in IntelligenceBriefing
- [ ] Add sticky CTA to SignalDetailPane
- [ ] Style all new elements
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
