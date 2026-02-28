# Signals All Redesign (Live Signals First)

## Intent
Refocus `Signals > All` as an operator flow:
1. Live signals list (Wealthsimple-style cards)
2. Combined causal map (horizon aware)
3. Signal contributions table (explains map attribution)

## Decisions
- Remove `Regime snapshot` block from main column.
- Keep right sidebar combined impact card.
- Default order of live signal cards: absolute 1M contribution impact descending.
- Clicking a signal card opens deep signal view (`/signals/:id`).
- Keep timeframe rail on causal map and maintain visual differentiation between 1W/1M/6M.

## UX Notes
- Headings must be outside white cards.
- Contribution table remains explanatory, below map.
- Keep copy: `Discuss with Prism`.

## Non-goals
- No backend/API shape changes.
- No changes to portfolio page layout.
