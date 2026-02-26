# Feature: Tension Alerts & Competing Effects

**ID:** 07
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 03

## Description

When a market event has competing effects on the portfolio (e.g., rate hike hurts financials but helps bonds), surface this as a distinct "tension alert" insight. The backend temporal reasoner already detects competing effects — this feature creates a dedicated UI component to highlight them.

## Acceptance Criteria

- [ ] Tension alert appears when a signal's causal chain contains both positive and negative edges to user holdings
- [ ] Shows concise summary: "This event has competing effects — [short-term pain] vs [long-term gain]"
- [ ] Visual indicator showing the tug-of-war (e.g., simple +/- bar or split indicator)
- [ ] Renders below the relevant signal card or as an inline callout
- [ ] Links to the full causal graph for detail

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/components/portfolio/TensionAlert.tsx` — New component
- `packages/frontend/src/styles/portfolio.css` — Tension alert styles

### Data Source

The temporal reasoner's `TemporalAnalysis` already includes:
- `competingEffects: boolean`
- `tensionAnalysis: string` (explanation text)
- Per-asset impact with direction (positive/negative)

This data comes through when causal chains are fetched. May need to pre-fetch or piggyback on signal impact estimates.

## Dependencies

### Depends On
- **Feature 03:** Enhanced signal cards provide the context where tension alerts appear

### Blocks
- None

## Testing Requirements

- [ ] Unit test: renders when competingEffects=true, hidden when false
- [ ] Test tension summary text formatting
- [ ] Test link to causal graph navigation

## Notes

- This is one of Prism's most unique insights — "your portfolio is conflicted" is something no brokerage app tells you
- Keep the alert concise; the full graph view provides the deep dive

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
