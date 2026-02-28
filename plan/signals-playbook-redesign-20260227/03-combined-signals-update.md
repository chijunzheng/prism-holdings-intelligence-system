# Feature: Combined Signals Pane Update

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** 01

## Description

Update the Combined Signals pane (`/signals` index) for the new 2-column layout. Add the signal chip strip at top. The main column shows net portfolio impact summary + contribution table. Sidebar shows combined impact card.

## Acceptance Criteria

- [ ] Signal chip strip at top with "All" chip active
- [ ] Main column: net impact summary (big dollar number) + signal contributions table
- [ ] Sidebar: combined impact card with signal count
- [ ] Clicking a signal in the chip strip or contributions table navigates to `/signals/:signalId`
- [ ] Layout matches Wealthsimple proportions (wide main + 340px sidebar)

## Implementation Details

### Files to Modify

- `frontend/src/routes/signals/CombinedSignalsPane.tsx` — Add `SignalChipStrip` at top. Restructure to render main content + sidebar as siblings (rendered by Outlet pattern from SignalsLayout).

### Existing Components Reused

- `SignalChipStrip` (created in Feature 01)
- `SignalContributionsTable` (`frontend/src/components/signal/SignalContributionsTable.tsx`)
- `usePortfolioNetImpact` (`frontend/src/hooks/usePortfolioNetImpact.ts`)
- `CausalGraph` — aggregated graph in main column

## Implementation Checklist

- [ ] Add chip strip to CombinedSignalsPane
- [ ] Verify 2-col layout renders correctly
- [ ] Verify build passes

---

**Created:** 2026-02-27
