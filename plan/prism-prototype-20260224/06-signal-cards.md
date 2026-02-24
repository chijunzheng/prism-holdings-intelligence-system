# Feature: Signal Cards on Portfolio View

**ID:** 06
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 04, 05

## Description

Build the Signal Card components that render in the "Active Signals" section of the Portfolio View. Signal cards are the bridge between passive awareness (X-Ray) and active analysis (Causal Graph View). They display live market events classified by the Signal Monitor, with temporal classification badges and a tap-through to the Causal Graph View.

## Why This Matters

Signal cards are the primary mechanism for pulling users into deeper analysis. A card that animates in with "BoC policy minutes signal tighter mortgage rules → impacts your 43% Canadian financials exposure" creates urgency and curiosity. The tap-through rate (target: >50%) determines whether users ever see the causal graph — the system's most powerful feature.

## Acceptance Criteria

- [x] Signal cards appear when signal exceeds materiality threshold *(implemented via deterministic urgency+relevance scoring; Feature 09 will replace with Alert Composer personalization)* (FR-7.1)
- [x] Maximum 3 cards displayed; overflow shows "View all (N) →" link (FR-7.2)
- [x] Each card shows: headline, temporal classification badge, materiality indicator, "View analysis →" CTA (FR-7.3)
- [x] Cards animate in when new signal arrives
- [x] Tapping card navigates to Causal Graph View with signal ID in route params (FR-7.4)
- [x] Cards persist until viewed or signal is no longer material
- [x] Cards show "Viewed" state after user has seen the analysis (FR-8.6)
- [x] Simulated in-app push notification for high-materiality signals (FR-7.5)
- [x] Source citation visible on card (subtle, linked)

## Implementation Details

### Files to Create/Modify

- `frontend/src/components/portfolio/SignalCard.tsx` — Individual signal card
- `frontend/src/components/portfolio/SignalCardsSection.tsx` — Container with max-3 logic
- `frontend/src/components/portfolio/SignalBadge.tsx` — Temporal classification badge (Transient/Structural/Ambiguous)
- `frontend/src/components/portfolio/InAppNotification.tsx` — Simulated push notification toast
- `frontend/src/components/portfolio/signal-utils.ts` — Materiality scoring, max-card/overflow logic, viewed-state persistence
- `frontend/src/hooks/useSignals.ts` — Hook to fetch/subscribe to classified signals
- `frontend/src/styles/signal-cards.css` — Animation and styling
- `frontend/src/routes/PortfolioView.tsx` — Integrate SignalCardsSection into Portfolio View
- `server/src/index.ts` — Add `/api/signals/:userId` endpoint

### Signal Card Layout

```
┌──────────────────────────────────────────┐
│ BoC policy minutes signal tighter        │
│ mortgage rules → impacts your 43%        │
│ Canadian financials exposure              │
│                                          │
│ ⏱ Structural risk · High materiality     │
│ Source: Bank of Canada    View analysis → │
└──────────────────────────────────────────┘
```

### Color Coding

| Classification | Badge Color | Border Accent |
|---------------|-------------|---------------|
| Transient | Blue | Blue-left-border |
| Structural | Red/Orange | Red-left-border |
| Ambiguous | Yellow | Yellow-left-border |

### Technical Decisions

- **CSS animations** for card entrance — `@keyframes slideIn` with subtle bounce
- **Route-based navigation** — card tap navigates to `/graph/:signalId`
- **Signal state in custom hook + local component state** — `useSignals` handles polling; component tracks viewed IDs
- **Viewed state tracked locally** — no backend persistence needed for prototype

## Dependencies

### Depends On
- **Feature 04:** Portfolio View provides the container/section for signal cards
- **Feature 05:** Signal Monitor provides classified signal data

### Blocks
- **Feature 12:** Orchestrator needs signal card → graph navigation working

## Testing Requirements

- [x] Unit tests: Max 3 cards enforced with overflow link
- [x] Unit tests: Badge mapping matches temporal classification
- [x] Unit tests: Signal ID route encoding helper used for card navigation
- [x] Unit tests: "Viewed" state persists after navigation
- [ ] Integration test: Live signals from Signal Monitor render as cards *(manual validation pending with running dev server)*
- [ ] Edge case UI snapshot test: No signals → section shows monitoring status only

## Implementation Checklist

- [x] Build SignalCard component with badge, headline, CTA
- [x] Build SignalCardsSection with max-3 logic
- [x] Build SignalBadge component with color coding
- [x] Build InAppNotification toast component
- [x] Create useSignals hook
- [x] Add entrance animation
- [x] Wire card tap to React Router navigation
- [x] Track viewed state
- [x] Write unit tests for signal-card utility logic
- [ ] Test with live Signal Monitor output *(requires user-run dev server)*

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
