# Feature 04: Portfolio View — Holdings & X-Ray — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Component composition with CSS-based bar chart (no D3 for simple bars)**

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| CSS bars + component composition | Simple, fast, animatable, no library | Limited interactivity | **Chosen** |
| D3.js for everything | Consistent with graph view | Massive overkill for horizontal bars | Rejected — D3 reserved for Feature 10 |
| Chart.js / Recharts | Rich chart types | Extra dependency for simple bars | Rejected |

### Why This Approach

D3.js is a powerful but complex library best reserved for the interactive causal graph (Feature 10). Simple horizontal bars with CSS `scaleX` animation are cleaner, lighter, and more customizable for this use case.

## Key Decisions

### Dark theme with financial-UI styling
- Dark background (`#0a0a0f`) reduces eye strain for financial dashboards
- Color coding: red for high concentration, orange for medium, yellow for warning, indigo for normal
- Tabular-nums font variant ensures dollar amounts align properly

### Bar animation for first-time reveal
- `@keyframes bar-grow` animates bars from `scaleX(0)` to `scaleX(1)`
- Staggered `animationDelay` (80ms per bar) creates a cascade effect
- This draws attention to concentration levels — the "aha moment"

### Server-dependent architecture
- The frontend fetches exposure data from `/api/exposure/:userId`
- Requires the Express server running on port 3001
- Vite proxy config forwards `/api/*` to the server

## What I Learned

1. **Component composition keeps files small.** 8 components averaging ~40 lines each instead of one 300-line page. Each component has a single responsibility.

2. **CSS `font-variant-numeric: tabular-nums`** is essential for financial UIs — it makes numbers the same width so columns align without monospace fonts.

3. **The PortfolioView needs both portfolio data AND exposure data.** Currently it only fetches exposure; the holdings list (AccountSummary, HoldingsList) needs the raw portfolio data too. This will be wired when the server endpoint returns both.

## Files Created

- 8 components in `frontend/src/components/portfolio/`
- `frontend/src/hooks/useExposureData.ts`
- `frontend/src/styles/portfolio.css` (~280 lines)
- `frontend/src/components/shared/Disclaimer.tsx`
