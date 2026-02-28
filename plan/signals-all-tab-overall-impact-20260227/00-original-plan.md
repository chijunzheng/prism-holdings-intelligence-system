# Signals "All" Tab Overall-Impact Upgrade

## Goal

Make the `/signals` **All** tab communicate the combined effect of all active signals on current holdings as clearly as the individual signal page.

## User Problem

The current All tab shows:
- chip strip
- one net-impact number
- causal graph
- contributions table

It does not clearly answer:
- Which holdings are most exposed overall right now?
- What is the upside/downside split across holdings?
- Which signals are driving most of the net outcome?
- What should the user do next?

## UX Direction

- Keep Wealthsimple-like calm spacing and clean card rhythm.
- Keep wide main + narrow sidebar layout.
- Add holdings-level aggregate sections before/alongside graph/table.
- Keep graph as explanation, not the only source of information.

## Scope

1. Add aggregate "portfolio pressure" summary metrics.
2. Add "Most affected holdings" list from combined chain asset nodes.
3. Add "Top drivers" split (positive vs negative signal drivers).
4. Improve vertical spacing and card hierarchy to reduce crowding.
5. Keep existing interactions: chip selection, graph node selection, signal row click-through.

## Out of Scope

- Backend schema changes.
- New endpoints.
- Playbook redesign in this pass.

