# Feature: Enhanced Signal Cards with Dollar Impact

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Enhance the existing SignalCard component to prominently display dollar impact estimates, affected portfolio percentage, temporal classification badge, and urgency-based color coding. The backend temporal reasoner already calculates per-asset dollar impact — this feature surfaces it on the card.

## Acceptance Criteria

- [ ] Each signal card shows estimated dollar impact (e.g., "-$1,200")
- [ ] Shows affected portfolio percentage (e.g., "Affects 22% of portfolio")
- [ ] Color-coded urgency indicator (red = critical/high, amber = medium, green = low)
- [ ] Temporal badge (transient/structural/ambiguous) with tooltip explanation
- [ ] "Advisor flag" badge when signal passes materiality threshold for advisor consultation
- [ ] Cards render full-width in a prominent row (not squeezed into sidebar)
- [ ] Tap/click still navigates to causal graph view (preserve existing behavior)
- [ ] Loading skeleton while signals are being fetched

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/components/portfolio/SignalCard.tsx` — Enhance with dollar impact, urgency colors
- `packages/frontend/src/components/portfolio/SignalCardsSection.tsx` — Full-width layout
- `packages/frontend/src/components/portfolio/SignalBadge.tsx` — Enhanced temporal + advisor badges
- `packages/frontend/src/styles/portfolio.css` — Updated signal card styles

### Data Flow

The signal cards currently show headline + description + affected exposures. To add dollar impact:
1. When signals load via `useSignals()`, also trigger causal chain pre-fetch for top signals
2. OR: Add a lightweight `/api/signals/:userId/impact` endpoint that returns just dollar estimates without full causal chain
3. OR: Compute estimated impact client-side from exposure percentages + signal relevance scores

### Key Components

1. **Enhanced SignalCard** — Displays headline, dollar impact, portfolio %, urgency color, temporal badge
2. **Impact estimate** — Either from pre-fetched causal chain or computed from exposure data
3. **Advisor flag** — Based on alert composer's materiality threshold logic

## Dependencies

### Depends On
- None (enhances existing SignalCard component)

### Blocks
- **Feature 05:** Layout restructure uses enhanced cards in the new prominent row
- **Feature 07:** Tension alerts build on the enhanced card format

## Testing Requirements

- [ ] Unit tests for dollar impact display formatting (positive/negative, rounding)
- [ ] Test urgency color mapping (critical→red, high→red, medium→amber, low→green)
- [ ] Test with 0, 1, 2, 3 signals
- [ ] Test loading state / skeleton
- [ ] Verify tap-to-graph navigation still works

## Notes

- Dollar impact makes the difference between "interesting news" and "this affects MY money"
- Even rough estimates are more valuable than no estimate — don't block on precision
- Consider caching impact estimates to avoid re-computation on every render

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
