# Signals All Refactor: Regime Control Tower (No Portfolio Overlap)

## Summary
`Signals > All` remains the `All` entry but shifts from holdings inventory semantics to a regime-analysis workspace.
It should answer: what is driving combined portfolio pressure now, how reliable is the view, and where to drill down next.

## Product Decisions (Locked)
- `All` role: Regime control tower.
- Right rail: Sticky action rail only, compact and non-duplicative.
- Signal cards: Medium-detail contribution cards.
- Holdings in `All`: Exception-first only (no full holdings table).

## Scope
1. Reorder `All` sections to: chip strip -> regime snapshot -> contribution cards -> causal map -> attribution table.
2. Replace holdings-heavy sections with exception insights only.
3. Refactor right rail to compact impact/risk/actions.
4. Align spacing/visual rhythm with Portfolio design language.
5. Keep navigation and drill-in behavior unchanged.

## Non-Goals
- No backend schema/API changes.
- No Playbook redesign in this pass.

## Target UX
- Calm, analytical control-tower page.
- Generous whitespace and card rhythm similar to Portfolio.
- Distinct from Portfolio ownership/exposure views.

## Files In Scope
- `frontend/src/routes/signals/CombinedSignalsPane.tsx`
- `frontend/src/styles/signals-workspace.css`
- `frontend/src/components/signal/SignalChipStrip.tsx`
- `frontend/src/components/signal/SignalContributionsTable.tsx` (secondary role only)
- `frontend/src/routes/signals/SignalsLayout.tsx` (only if shell alignment needed)

## Verification
- Build passes.
- Signals `All` removes full holdings table.
- Contribution cards are medium detail with clear drill-in CTA.
- Right rail is compact and non-duplicative.
- Portfolio page remains unchanged.
