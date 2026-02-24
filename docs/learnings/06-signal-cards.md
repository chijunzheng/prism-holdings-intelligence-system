# Feature 06: Signal Cards on Portfolio View — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Frontend-first signal delivery with local materiality scoring + server passthrough endpoint**

### Why This Approach

Feature 09 (Alert Composer) is not implemented yet, but Feature 06 still needs material signal cards, viewed-state, and tap-through navigation. The implementation uses deterministic urgency+relevance scoring in `signal-utils.ts` as a prototype threshold model, then keeps the API/UX contract ready for personalized thresholds in Feature 09.

## Key Decisions

### New `/api/signals/:userId` endpoint
- Server now composes:
  1. portfolio lookup
  2. exposure analysis
  3. signal monitor call
- This keeps frontend signal fetching simple (`useSignals(userId)`), while preserving agent pipeline order.

### Viewed-state persisted in local storage
- `prism.viewed.signals:<userId>` stores read signals.
- State survives navigation and refresh, enabling FR-8.6 without backend persistence.

### Max-3 cards with overflow toggle
- UI renders top 3 material cards by priority.
- Overflow uses `View all (N) →` to reveal full material list.
- Signal monitor now returns up to 5 candidates; UI controls display density.

### Simulated push notification behavior
- High-materiality unseen signal triggers an in-app toast.
- Toast supports dismiss and direct jump to graph analysis.

## What I Learned

1. **Card count and monitor count should be separate constraints.**
   - Limiting monitor results to 3 prevents overflow UX entirely.
   - Split into `MAX_SIGNAL_MONITOR_RESULTS` (backend candidates) and `MAX_ACTIVE_SIGNALS` (UI default display).

2. **Project reference config was incomplete for build verification.**
   - `shared` needed `composite: true` and a `build` script for `tsc -b` references.

3. **Utility-first testing worked without adding RTL/jsdom tooling.**
   - Core requirements (materiality, max-3, route encoding, viewed persistence) were covered through pure-function tests.

## Files Created/Modified

- `frontend/src/components/portfolio/{SignalBadge,SignalCard,SignalCardsSection,InAppNotification}.tsx`
- `frontend/src/components/portfolio/signal-utils.ts`
- `frontend/src/components/portfolio/__tests__/signal-utils.test.ts`
- `frontend/src/hooks/useSignals.ts`
- `frontend/src/styles/signal-cards.css`
- `frontend/src/routes/PortfolioView.tsx`
- `server/src/index.ts`
- `agents/src/signal-monitor/index.ts`
- `shared/src/constants/thresholds.ts`
- `shared/{package.json,tsconfig.json}`
