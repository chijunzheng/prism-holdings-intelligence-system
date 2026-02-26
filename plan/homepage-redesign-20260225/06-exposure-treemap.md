# Feature: Exposure Treemap Visualization

**ID:** 06
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** 05

## Description

Replace (or offer as alternative to) the existing donut/pie chart with an interactive D3 treemap visualization. Treemaps show proportional area more intuitively for 10+ categories, with rectangles sized by exposure percentage and colored by risk level (green = healthy, amber = elevated, red = concentrated).

## Acceptance Criteria

- [ ] D3 treemap renders all exposure categories as proportional rectangles
- [ ] Color coding: green (< 10%), amber (10-20%), red (> 20%) concentration
- [ ] Tap/click a sector rectangle to expand and show contributing ETFs
- [ ] Hover shows tooltip with category name, percentage, dollar value
- [ ] Smooth transition animation on data change (profile switch)
- [ ] Responsive sizing
- [ ] Accessible: keyboard navigable, ARIA labels

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/components/portfolio/ExposureTreemap.tsx` — New D3 treemap component
- `packages/frontend/src/styles/portfolio.css` — Treemap styles

### Key Components

1. **ExposureTreemap** — D3 treemap layout consuming ExposureMap data
2. **TreemapCell** — Individual rectangle with label, color, click handler
3. **Drill-down view** — On click, show which ETFs contribute to that sector

## Dependencies

### Depends On
- **Feature 05:** Layout restructure provides the container for this visualization

### Blocks
- **Feature 08:** Scenario Playground uses treemap to show before/after comparison

## Testing Requirements

- [ ] Renders correctly with varying number of sectors (5-20)
- [ ] Color thresholds correct
- [ ] Click interaction works
- [ ] Responsive at different viewport sizes

## Notes

- D3's `d3.treemap()` layout makes this straightforward — the codebase already uses D3 for the causal graph
- Consider keeping the pie chart as a toggle option for users who prefer it

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
