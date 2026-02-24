# Feature: Portfolio View — Holdings & X-Ray

**ID:** 04
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 03

## Description

Build the Portfolio View — the system's home base. Displays the user's holdings list, account summary, and the always-on Exposure X-Ray that shows true sector/geography exposure breakdown, concentration warnings, and overlapping holdings. This is what the user sees on every app open — the passive intelligence layer.

## Why This Matters

The X-Ray is the first-time "hook" that establishes the system's value: "You hold 6 ETFs across 3 accounts. Here's what you actually own underneath." It must render automatically on page load with zero user action. The concentration warning ("43% Canadian financials") is the demo's centerpiece moment.

## Acceptance Criteria

- [ ] Account summary: total portfolio value, daily change, account selector (TFSA/RRSP/All)
- [ ] Holdings list: ticker, name, value, daily change for each holding
- [ ] X-Ray section renders automatically on page load (FR-6.1)
- [ ] Horizontal bar chart showing true sector exposure breakdown (FR-6.2)
- [ ] Concentration warnings inline when thresholds exceeded (FR-6.3)
- [ ] Overlapping holdings section: "Apple appears in VFV + XQQ — 7.2% total" (FR-6.4)
- [ ] Monitoring status line: "Monitoring N signal categories relevant to your top exposures" (FR-6.5)
- [ ] Active Signals section placeholder (populated by Feature 06)
- [ ] Regulatory disclaimer visible on screen (PRD Section 9)
- [ ] First-time experience: concentration reveal as primary insight (PRD Section 4.6)
- [ ] Responsive layout matching PRD mockup (Section 4.6)

## Implementation Details

### Files to Create/Modify

- `frontend/src/routes/PortfolioView.tsx` — Main page component
- `frontend/src/components/portfolio/AccountSummary.tsx` — Header with value, change, account selector
- `frontend/src/components/portfolio/HoldingsList.tsx` — Holdings table
- `frontend/src/components/portfolio/ExposureXRay.tsx` — The X-Ray section
- `frontend/src/components/portfolio/ExposureBar.tsx` — Individual horizontal bar
- `frontend/src/components/portfolio/ConcentrationWarning.tsx` — Warning banner
- `frontend/src/components/portfolio/OverlapList.tsx` — Overlapping holdings
- `frontend/src/components/portfolio/MonitoringStatus.tsx` — "Monitoring N categories"
- `frontend/src/components/shared/Disclaimer.tsx` — Regulatory disclaimer
- `frontend/src/components/portfolio/SignalCardsSection.tsx` — Empty container for Feature 06
- `frontend/src/hooks/useExposureData.ts` — Hook to invoke Exposure Analyzer and cache result
- `frontend/src/styles/portfolio.css` — Portfolio View styles

### Layout Structure (from PRD Section 4.6)

```
┌──────────────────────────────────────────────┐
│ AccountSummary (value, change, account picker)│
│ [Performance chart placeholder]               │
│                                               │
│ HoldingsList                                  │
│                                               │
│ ─── divider ───                               │
│                                               │
│ ⚡ ExposureXRay                               │
│   ConcentrationWarning (if applicable)        │
│   ExposureBar × N (sector breakdown)          │
│   OverlapList                                 │
│                                               │
│ ─── divider ───                               │
│                                               │
│ 🟡 SignalCardsSection (Feature 06)            │
│   MonitoringStatus                            │
│                                               │
│ Disclaimer                                    │
└──────────────────────────────────────────────┘
```

### Technical Decisions

- **Exposure data fetched once on mount** — cached in state; re-fetched only on portfolio change
- **Bar chart built with plain CSS** (not D3) — D3 is reserved for the complex Causal Graph; simple bars don't need it
- **Component composition** — each section is its own component for testability and readability
- **Immutable state** — all exposure data treated as readonly from the hook

## Dependencies

### Depends On
- **Feature 03:** ExposureMap data from Exposure Analyzer

### Blocks
- **Feature 06:** Signal Cards render inside this view

## Testing Requirements

- [ ] Unit tests: Each component renders correctly given sample ExposureMap data
- [ ] Unit tests: ConcentrationWarning appears/hides at correct thresholds
- [ ] Unit tests: OverlapList correctly displays overlapping assets
- [ ] Unit tests: Account selector filters holdings by account type
- [ ] Integration test: Full PortfolioView renders with demo data, X-Ray visible
- [ ] Visual test: Layout matches PRD mockup structure

## Implementation Checklist

- [ ] Build AccountSummary component
- [ ] Build HoldingsList component
- [ ] Build ExposureXRay with horizontal bar chart
- [ ] Build ConcentrationWarning component
- [ ] Build OverlapList component
- [ ] Build MonitoringStatus component
- [ ] Build Disclaimer component
- [ ] Create useExposureData hook
- [ ] Compose PortfolioView page from components
- [ ] Style to match PRD mockup
- [ ] Write component unit tests
- [ ] Verify demo renders 43% concentration warning

## Notes

- The X-Ray bars should show percentage AND be color-coded (warm colors for high concentration)
- Concentration warning should scale severity visually: yellow for warning threshold, red for critical
- The "first-time experience" can be implemented as a subtle animation on first render — bars animating from 0 to actual values draws attention

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
