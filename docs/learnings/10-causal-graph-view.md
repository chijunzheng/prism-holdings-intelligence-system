# Feature 10: Causal Graph View — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**React-owned SVG graph with deterministic rank layout and utility-driven visual encoding**

### Why This Approach

The graph needed to stay readable and deterministic for demo reliability. A fixed rank layout (event → mechanism → sector → asset) avoids force-layout jitter while still supporting interaction, filtering, and clustering.

## Key Decisions

### Route-level graph orchestration
- `frontend/src/routes/CausalGraphView.tsx` now owns:
  - signal switching
  - time horizon selection (1W/1M/6M)
  - counterfactual toggle
  - depth expand/collapse
  - selected-node drawer (Feature 11 handoff point)

### Componentized graph rendering
- Added dedicated graph components:
  - `CausalGraph.tsx`
  - `GraphNode.tsx`
  - `GraphEdge.tsx`
  - `GraphTooltip.tsx`
  - `TimeSlider.tsx`
  - `CounterfactualToggle.tsx`
  - `SignalSwitcher.tsx`
  - `GraphLegend.tsx`

### Visual encoding centralized in utilities
- `graph-utils.ts` controls core mappings:
  - edge color by direction
  - edge thickness by magnitude
  - edge opacity by confidence
  - depth filtering and asset clustering
  - horizon/counterfactual impact adjustments

### Responsive graph canvas
- `ResizeObserver` keeps SVG layout in sync with container size.
- Graph remains usable on mobile and desktop breakpoints.

## What I Learned

1. **Deterministic rank layout is enough for prototype clarity.**
   - Dagre/ELK is optional at this stage; rank grouping with spacing delivered readable chains quickly.

2. **Clustering + depth toggle reduces cognitive load.**
   - Collapsing lower-impact assets and limiting default depth made dense graphs much easier to scan.

3. **Counterfactual should degrade gracefully.**
   - Disabling the toggle when analysis is absent prevents confusing empty-state behavior.

## Verification

- `pnpm test`
- `pnpm build`

Both commands passed after implementation.

## Files Created/Modified

- `frontend/src/routes/CausalGraphView.tsx`
- `frontend/src/components/graph/CausalGraph.tsx`
- `frontend/src/components/graph/GraphNode.tsx`
- `frontend/src/components/graph/GraphEdge.tsx`
- `frontend/src/components/graph/GraphTooltip.tsx`
- `frontend/src/components/graph/TimeSlider.tsx`
- `frontend/src/components/graph/CounterfactualToggle.tsx`
- `frontend/src/components/graph/SignalSwitcher.tsx`
- `frontend/src/components/graph/GraphLegend.tsx`
- `frontend/src/components/graph/graph-utils.ts`
- `frontend/src/components/graph/__tests__/graph-utils.test.ts`
- `frontend/src/hooks/useCausalChain.ts`
- `frontend/src/hooks/useGraphLayout.ts`
- `frontend/src/styles/graph.css`
- `plan/prism-prototype-20260224/10-causal-graph-view.md`
- `plan/prism-prototype-20260224/00-overview.md`
