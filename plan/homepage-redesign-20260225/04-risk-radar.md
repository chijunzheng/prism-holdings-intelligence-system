# Feature: Risk Radar Sidebar

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 01

## Description

Replace the current low-value right sidebar (exposure category count + overlap list) with a focused Risk Radar panel showing portfolio health score, sub-dimension scores, and key risk indicators at a glance.

## Acceptance Criteria

- [ ] Displays portfolio health letter grade prominently (large, colored: green A-B, amber C, red D-F)
- [ ] Shows 4 sub-scores as mini gauges or progress bars: Diversification, Concentration, Overlap, Freshness
- [ ] Each sub-score has a one-line explanation (e.g., "3 sectors above 20% threshold")
- [ ] Quick-action links: "View concentrations" scrolls to exposure section, "View overlaps" opens detail
- [ ] Responsive: collapses to horizontal bar on mobile
- [ ] Updates reactively when exposure data changes (e.g., profile switch)

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/components/portfolio/RiskRadar.tsx` — New sidebar component
- `packages/frontend/src/styles/portfolio.css` — Risk radar styles

### Key Components

1. **RiskRadar** — Consumes HealthScore from `usePortfolioHealth` hook (Feature 01)
2. **SubScoreBar** — Reusable mini progress bar for each dimension
3. **HealthGrade** — Large letter grade with color coding

## Dependencies

### Depends On
- **Feature 01:** Portfolio health score for all displayed data

### Blocks
- **Feature 05:** Layout restructure places Risk Radar in the new sidebar position

## Testing Requirements

- [ ] Unit tests for grade color mapping
- [ ] Test with varying health scores (A+ through F)
- [ ] Verify responsive collapse behavior

## Notes

- Keep it scannable — user should understand portfolio risk posture in <3 seconds
- The old sidebar content (overlap list, exposure count) can be moved to an expandable section or the exposure detail view

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
