# Feature: Causal Graph View — D3.js Interactive Visualization

**ID:** 10
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 07, 08

## Description

Build the full-screen interactive Causal Graph View using D3.js that renders the causal propagation chain as a directed node-edge graph. Event nodes on the left, mechanism nodes in the center, holding nodes on the right — with edges encoding magnitude (thickness), direction (color), and confidence (opacity). Includes time slider, counterfactual toggle, and node click → Chat Panel interaction.

## Why This Matters

This is the most visually impressive and analytically powerful feature. It transforms abstract causal reasoning into something a retail investor can see, explore, and understand. The graph must balance information density with readability — showing competing effects, confidence levels, and dollar impacts without overwhelming the user.

## Acceptance Criteria

- [x] Renders CausalChain JSON as interactive node-edge graph (FR-8.1)
- [x] Left-to-right layout: event → mechanism → sector → holding nodes
- [x] Edge thickness = magnitude, color = direction (green/red/yellow), opacity = confidence (FR-8.2)
- [x] Temporal classification visually indicated on nodes (FR-8.3)
- [x] Click any node → opens Chat Panel drawer (FR-8.4)
- [x] Hover → tooltip with dollar impact, confidence, time horizon (FR-8.4)
- [x] Expand/collapse 2nd/3rd order effects (FR-8.4)
- [x] Counterfactual toggle re-renders graph with modified impacts (FR-8.4)
- [x] Time slider: 1-week / 1-month / 6-month projections (FR-8.4)
- [x] Readable with up to 15-20 nodes; clusters beyond that (FR-8.5)
- [x] Back navigation returns to Portfolio View with "Viewed" state on card (FR-8.6)
- [x] Signal switcher for multiple active signals (FR-8.7)
- [x] Regulatory disclaimer visible (PRD Section 9)

## Implementation Details

### Files to Create/Modify

- `frontend/src/routes/CausalGraphView.tsx` — Page component
- `frontend/src/components/graph/CausalGraph.tsx` — D3 graph container
- `frontend/src/components/graph/GraphNode.tsx` — Node rendering (event/mechanism/sector/asset)
- `frontend/src/components/graph/GraphEdge.tsx` — Edge rendering with visual encoding
- `frontend/src/components/graph/GraphTooltip.tsx` — Hover tooltip
- `frontend/src/components/graph/TimeSlider.tsx` — 1w/1m/6m time horizon slider
- `frontend/src/components/graph/CounterfactualToggle.tsx` — Toggle switch
- `frontend/src/components/graph/SignalSwitcher.tsx` — Multi-signal navigation
- `frontend/src/components/graph/GraphLegend.tsx` — Visual encoding legend
- `frontend/src/hooks/useCausalChain.ts` — Hook to fetch chain data for signal ID
- `frontend/src/hooks/useGraphLayout.ts` — D3 force/dagre layout computation
- `frontend/src/styles/graph.css` — Graph styling

### Layout Algorithm

Use a deterministic rank-based layout utility for the left-to-right hierarchical layout:
- Rank 0: Event nodes (leftmost)
- Rank 1: Mechanism nodes
- Rank 2: Sector/industry nodes
- Rank 3: Asset/holding nodes (rightmost)

This keeps the graph predictable and easy to scan while avoiding force-layout drift in the prototype.

### Node Visual Design

| Node Type | Shape | Color | Size |
|-----------|-------|-------|------|
| Event | Rounded rectangle | Dark blue | Large |
| Mechanism | Pill/capsule | Gray | Medium |
| Sector | Rounded rectangle | Sector color | Medium |
| Asset/Holding | Circle | Green/red based on impact | Proportional to dollar impact |

### Edge Visual Encoding

```
thickness = magnitude * maxThickness (1-8px range)
color = direction === 'positive' ? '#22c55e' : direction === 'negative' ? '#ef4444' : '#eab308'
opacity = confidence (0.3 min to 1.0 max)
```

### Competing Effects

When two edges point to the same node with different directions, render both:
- Split the node with a diagonal line: green half / red half
- Or stack two edges with clear visual separation
- Tooltip shows net impact with both paths explained

### Technical Decisions

- **Deterministic rank layout over force-directed layout** — prototype-friendly left-to-right consistency without unstable node drift
- **SVG over Canvas** — SVG supports per-element interactions (click, hover) natively; Canvas would need hit detection
- **React + D3 hybrid** — React owns the DOM and state; D3 handles layout computation and transitions only (no D3 DOM manipulation)
- **Counterfactual as data swap** — toggle swaps the CausalChain data, graph re-renders with D3 transitions

## Dependencies

### Depends On
- **Feature 07:** CausalChain JSON to render
- **Feature 08:** Temporal classifications and time-bucketed estimates

### Blocks
- **Feature 11:** Chat Panel opens from node click on this graph
- **Feature 12:** Orchestrator needs graph rendering for demo flow

## Testing Requirements

- [x] Unit tests: Edge visual encoding (thickness, color, opacity) matches data
- [x] Unit tests: Depth filtering, clustering, and deterministic positioning logic
- [x] Unit tests: Horizon-based impact scaling and counterfactual adjustment
- [ ] Integration test: Signal ID in route → fetch chain → render graph
- [ ] Visual test: Graph is readable with 15-node test chain
- [ ] Node interaction test: click + tooltip behavior

## Implementation Checklist

- [x] Implement rank-based layout computation
- [x] Build CausalGraph container with SVG
- [x] Build node components by type (event, mechanism, sector, asset)
- [x] Build edge rendering with visual encoding
- [x] Implement hover tooltips
- [x] Implement node click → open contextual drawer for chat handoff
- [x] Build TimeSlider component
- [x] Build CounterfactualToggle
- [x] Build SignalSwitcher for multi-signal navigation
- [x] Add expand/collapse for 2nd/3rd order effects
- [x] Add node clustering for 15+ node chains
- [x] Build GraphLegend
- [ ] Add entrance animations / transitions
- [x] Add Disclaimer component
- [x] Write graph utility tests
- [x] Test with real causal chain data from Feature 07 endpoint wiring

## Notes

- **React + D3 boundary is critical.** React manages state and DOM; D3 computes layout coordinates only. Never let D3 touch the DOM directly — this causes React reconciliation conflicts. Use `d3.dagre` for layout, then map coordinates to React SVG elements.
- The counterfactual toggle needs a second CausalChain (the "rebalanced" version) from Feature 08. If not available, disable the toggle with a "counterfactual not available" tooltip.
- Graph legend should explain: edge color = direction, thickness = magnitude, opacity = confidence, node icons = temporal classification.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
