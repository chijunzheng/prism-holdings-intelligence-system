# Feature: Restore Signal Cards + Fix Navigation

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** None
**Phase:** 1 — Fix the Plumbing
**Plan References:** F1, F2

## Description

Two critical flow fixes bundled together:

1. **F1 — Restore Signal Cards on Portfolio View:** `SignalCardsSection` is fully built (`frontend/src/components/portfolio/SignalCardsSection.tsx`) but not rendered in `PortfolioView`. The component exists with full filtering, skeleton loading, and navigation — it just needs to be imported and placed. The "pull" mechanism (signals pulling users into the graph) is dead without this.

2. **F2 — Fix "Build a Plan" Navigation:** `SignalImpactSidebar.tsx` (line ~101) uses `<a href="/signals/${signalId}/plan">` instead of `<Link to={...}>`, causing a full page reload and loss of React state when navigating to the plan builder.

## Acceptance Criteria

- [ ] `SignalCardsSection` renders on `PortfolioView` between `IntelligenceBriefing` and holdings
- [ ] Signal cards show for the current user's active signals
- [ ] Clicking a signal card navigates to the signal detail via React Router (no page reload)
- [ ] "Build a plan" link in `SignalImpactSidebar` uses React Router `<Link>` — no full page reload
- [ ] Signal cards respect the max 3 active cards constraint (handled by existing `sortSignalsForCards`)
- [ ] Loading/error/empty states work correctly

## Implementation Details

### Files to Modify

- `frontend/src/routes/PortfolioView.tsx` — Import and render `SignalCardsSection`
- `frontend/src/components/signal/SignalImpactSidebar.tsx` — Replace `<a href>` with `<Link to>`

### F1: PortfolioView Changes

`SignalCardsSection` accepts these props (already built):
```typescript
{
  userId: string
  signals: ReadonlyArray<Signal>
  loading: boolean
  error: string | null
  exposures?: ReadonlyArray<ExposureEntry>
  totalPortfolioValue?: number
}
```

`PortfolioView` already has `useSignals(userId)` returning `{ signals, loading, error }` and `useExposureData(userId)` returning `{ exposures }`. Wire these directly.

Place between `IntelligenceBriefing` and the holdings section.

### F2: SignalImpactSidebar Change

Replace:
```tsx
<a className="signal-sidebar__cta" href={`/signals/${signalId}/plan`}>
```
With:
```tsx
<Link className="signal-sidebar__cta" to={`/signals/${signalId}/plan`}>
```

Add `import { Link } from 'react-router-dom'` at the top.

## Testing Requirements

- [ ] Unit test: `PortfolioView` renders `SignalCardsSection` when signals are loaded
- [ ] Unit test: `SignalImpactSidebar` renders `<Link>` not `<a>` for plan CTA
- [ ] Manual: Click signal card → navigates without page reload
- [ ] Manual: Click "Build a plan" → navigates without page reload

## Implementation Checklist

- [ ] Import `SignalCardsSection` in `PortfolioView.tsx`
- [ ] Wire signal/exposure props from existing hooks
- [ ] Place component in correct position in the layout
- [ ] Replace `<a href>` with `<Link to>` in `SignalImpactSidebar.tsx`
- [ ] Import `Link` from `react-router-dom`
- [ ] Test navigation flows manually
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
