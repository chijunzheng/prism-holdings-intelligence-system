# Feature: Signals List View

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** None

## Description

Full-page view showing all active signals as cards in a responsive grid layout. Replaces the redirect from /signals to /portfolio. Reuses existing `useSignals` hook and `SignalCard` component.

## Acceptance Criteria

- [ ] `/signals` shows all active signals in a responsive grid
- [ ] Signal cards reuse existing `SignalCard` component
- [ ] Click card navigates to `/signals/:signalId` (Signal Detail)
- [ ] Loading state shows while signals fetch
- [ ] Empty state: "No active signals. Prism is monitoring."
- [ ] Error state displays fetch errors
- [ ] Page header: "Active Signals" with subtitle

## Implementation Details

### Files to Create

- `frontend/src/routes/SignalsListView.tsx` — route component
- `frontend/src/styles/signals-list.css` — responsive grid styles

### Key Components

1. **`SignalsListView.tsx`**
   - Uses `useAppContext` for userId, `useSignals` for signal data, `useExposureData` for exposure context
   - Renders `SignalCard` components in a CSS grid
   - `onViewAnalysis` navigates to `/signals/:signalId`
   - Reuses `markSignalViewed` / `readViewedSignalIds` for viewed state
   - Loading/empty/error states

2. **`signals-list.css`**
   - Responsive grid: `grid-template-columns: repeat(auto-fill, minmax(350px, 1fr))`
   - Max width 1200px, centered
   - Clean spacing following Portfolio page patterns

### Technical Decisions

- **Reuse, don't rebuild:** SignalCard and useSignals already exist. This view is just a full-page layout wrapper.
- **All signals shown:** Unlike Portfolio (max 3), this shows all active signals.

## Dependencies

### Depends On
- Nothing — uses existing hooks and components

### Blocks
- **Feature 04:** Navigation needs this view to exist before routing to it

## Testing Requirements

- [ ] Component renders without errors
- [ ] Empty state displays when no signals
- [ ] Card click navigates correctly

## Security Considerations

- [ ] No new security concerns — same data flow as Portfolio

## Implementation Checklist

- [ ] Create SignalsListView.tsx
- [ ] Create signals-list.css
- [ ] Verify build compiles

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
