# Feature: Portfolio-Net Impact Mode + Signal Drill-Down

**ID:** 13
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 05, 07, 08, 10, 12

## Description

Add a portfolio-level impact mode that aggregates all active signals above threshold into one net view for actions and holdings impact, while preserving per-signal drill-down graph analysis.

## Acceptance Criteria

- [x] New "Portfolio Net" mode aggregates all active signals above threshold
- [x] Existing per-signal graph view remains available as "Signal Drill-down"
- [x] Actions tab in Portfolio Net mode uses aggregated analysis (not single signal)
- [x] Portfolio Net mode shows contribution breakdown by signal for transparency
- [x] Default 3rd-order nodes are tradeable holdings; constituent look-through is available on demand
- [x] Recommendation sizing uses confidence + recency weighted aggregation
- [x] Recommendation sizing enforces horizon caps and single-name concentration caps
- [x] Frontend clearly indicates which mode is active
- [x] Tests cover aggregation + mode switching + recommendation guardrails

## Technical Decisions

- **Weighting model:** confidence + recency decay
- **Signal inclusion:** all signals above threshold
- **Conflict handling:** show net effect and per-signal contribution
- **3rd-order nodes:** hybrid (holdings default, constituent context optional)
- **Recommendations:** tradeable instruments only

## Files to Modify

- `server/src/index.ts`
- `agents/src/orchestrator/index.ts`
- `agents/src/temporal-reasoner/index.ts`
- `agents/src/temporal-reasoner/types.ts`
- `agents/src/temporal-reasoner/recommendations.ts`
- `frontend/src/routes/ImpactAnalysisView.tsx`
- `frontend/src/hooks/useCausalChain.ts`
- `frontend/src/types/graph.ts`
- `frontend/src/components/impact/ActionsPanel.tsx`
- `frontend/src/components/impact/NodeDetails.tsx`

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** Codex
