# Feature: Homepage Layout Restructure

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 02, 03, 04

## Description

Restructure the PortfolioView from holdings-first to intelligence-first layout. This is the integration feature that assembles the Intelligence Briefing (02), Enhanced Signal Cards (03), Risk Radar (04), and existing components into the new hierarchy:

1. Intelligence Briefing (hero)
2. Live Signal Cards (prominent full-width row)
3. True Exposure visualization + Risk Radar (side by side)
4. Holdings list (collapsible, secondary)
5. Disclaimer

## Acceptance Criteria

- [ ] New layout order: Briefing → Signals → Exposure+Radar → Holdings → Disclaimer
- [ ] Holdings section is collapsible (default: collapsed if signals exist, expanded if no signals)
- [ ] Exposure section retains existing pie chart (treemap is Feature 06)
- [ ] All existing navigation preserved (Impact Analysis, Ask Prism, profile switcher)
- [ ] Smooth scroll from briefing CTA to signal cards section
- [ ] Responsive: stacks vertically on mobile (Risk Radar below exposure, not beside)
- [ ] No functionality regression — all existing features work

## Implementation Details

### Files to Modify

- `packages/frontend/src/routes/PortfolioView.tsx` — Major restructure of component ordering and layout
- `packages/frontend/src/styles/portfolio.css` — New grid/flexbox layout, collapsible section styles

### Layout Structure

```tsx
<PortfolioView>
  <IntelligenceBriefing />          {/* Feature 02 */}
  <SignalCardsSection />             {/* Feature 03 - enhanced */}
  <div className="exposure-radar-row">
    <ExposureSection />              {/* Existing pie chart + X-ray */}
    <RiskRadar />                    {/* Feature 04 */}
  </div>
  <CollapsibleHoldings />            {/* Existing HoldingsList, now collapsible */}
  <Disclaimer />
</PortfolioView>
```

### Key Changes

1. **Remove old sidebar** — ConcentrationWarning, OverlapList, MonitoringStatus move into RiskRadar or become expandable
2. **Add collapsible wrapper** — Around HoldingsList with expand/collapse toggle
3. **CSS grid restructure** — From 2-column (main + sidebar) to single-column sections

## Dependencies

### Depends On
- **Feature 02:** Intelligence Briefing component
- **Feature 03:** Enhanced Signal Cards
- **Feature 04:** Risk Radar sidebar

### Blocks
- **Feature 06:** Treemap replaces pie chart within the exposure section
- **Feature 08:** Scenario Playground integrates into the exposure section

## Testing Requirements

- [ ] Visual regression: all sections render in correct order
- [ ] Collapsible holdings: toggle works, default state correct
- [ ] Navigation: signal card tap → Impact Analysis view works
- [ ] Profile switch: all sections update correctly
- [ ] Responsive: mobile layout stacks properly
- [ ] No console errors or broken imports

## Security Considerations

- [ ] No new user input introduced (layout-only change)

## Notes

- This is the highest-risk feature — it touches the main view. Keep existing components intact, just reorder and restyle.
- Consider feature-flagging the old layout so it can be reverted if needed.

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
