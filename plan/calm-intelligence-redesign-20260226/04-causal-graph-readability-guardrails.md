# Feature: Causal Graph Readability Guardrails

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Make `CausalGraph.tsx` work well at embedded size (inside Signal Detail page) with node/edge budgets, main-path pruning, and auto-grouping. Support both full canvas mode (existing behavior preserved) and a new embedded mode optimized for fixed-height containers.

The current graph renders all nodes from the causal chain without budgets, which works for a full-canvas view but creates visual clutter when embedded in a content page.

## Acceptance Criteria

- [ ] `CausalGraph` accepts a `mode` prop: `'canvas'` (default, existing behavior) or `'embedded'`
- [ ] Embedded mode renders within a fixed container height (~400px) with no overflow/scrolling within the graph
- [ ] Node budget enforced: configurable cap, default 15 for embedded, 40 for canvas
- [ ] Edge budget enforced: default 30 for embedded
- [ ] "Main path only" toggle available — prunes to top-K paths per holding (K=2)
- [ ] Auto-grouping: collapses intermediate mechanism nodes when >3 on same path into a cluster
- [ ] Embedded mode removes chrome (no reset view button, no standalone legend — use tooltip)
- [ ] Node tap/click still works in embedded mode and emits events for bottom sheet integration
- [ ] Canvas mode behavior is unchanged (no regressions)

## Implementation Details

### Files to Modify

- `frontend/src/components/graph/CausalGraph.tsx` — add mode prop, budgets, pruning
- `frontend/src/components/graph/GraphNode.tsx` — support grouped/collapsed nodes
- `frontend/src/components/graph/GraphEdge.tsx` — respect edge budget

### Files to Create

- `frontend/src/components/graph/graph-pruning.ts` — pure functions for path pruning, node budgeting, auto-grouping
- `frontend/src/components/graph/graph-pruning.test.ts` — tests for pruning logic

### Key Components

1. **`graph-pruning.ts`** — Pure pruning functions (no React, no D3)
   - `pruneToTopPaths(chain, k)` — keep top K paths per holding node, ranked by contribution weight * confidence
   - `enforceNodeBudget(chain, maxNodes)` — remove lowest-confidence nodes until under budget
   - `enforceEdgeBudget(chain, maxEdges)` — remove lowest-confidence edges until under budget
   - `autoGroupMechanisms(chain, threshold)` — when >threshold mechanism nodes on same path, collapse into single "N mechanisms" group node
   - All functions are pure: take chain in, return new chain out (immutable)

2. **CausalGraph mode prop**
   - `mode: 'canvas' | 'embedded'` (default `'canvas'`)
   - Embedded mode:
     - Applies pruning pipeline: `pruneToTopPaths` → `enforceNodeBudget` → `enforceEdgeBudget` → `autoGroupMechanisms`
     - Hides: reset view button, standalone legend, zoom controls
     - Adds: tooltip on hover for node details
     - Fits graph to container (D3 zoom-to-fit on render)
     - Fixed height via CSS, no internal scrolling
   - Canvas mode:
     - No pruning by default (existing behavior)
     - All controls visible
     - Optional: user can toggle "Main path only"

3. **Grouped node rendering**
   - Collapsed group shows: "3 mechanisms" with expand icon
   - On click: expands group inline (or emits event for bottom sheet)
   - Visual: slightly larger node with count badge

### Technical Decisions

- **Pruning is client-side:** The causal chain JSON already contains confidence scores and contribution weights on edges. Pruning doesn't need a server call.
- **Immutable pruning functions:** All pruning takes chain data in, returns new data out. No mutation of the original chain. This makes it testable and composable.
- **Zoom-to-fit in embedded mode:** After D3 renders, calculate bounding box and apply transform to fit all visible nodes within the container. No user zoom controls needed.
- **Preserve canvas mode exactly:** All changes are gated behind the `mode` prop. Canvas mode should have zero behavior changes.

## Dependencies

### Depends On
- None — can be built in parallel with Feature 01

### Blocks
- **Feature 02:** Signal Detail Page needs embedded mode for its inline graph

## Testing Requirements

- [ ] Unit tests: `pruneToTopPaths` correctly selects top-K paths
- [ ] Unit tests: `enforceNodeBudget` removes lowest-confidence nodes
- [ ] Unit tests: `enforceEdgeBudget` removes lowest-confidence edges
- [ ] Unit tests: `autoGroupMechanisms` collapses correctly when threshold exceeded
- [ ] Unit tests: pruning functions are pure (don't mutate input)
- [ ] Unit tests: pruning pipeline composes correctly
- [ ] Integration tests: embedded mode renders within height constraint
- [ ] Integration tests: canvas mode behavior unchanged
- [ ] Integration tests: node click emits event in embedded mode

## Security Considerations

- [ ] No security impact — this is purely client-side rendering logic

## Implementation Checklist

- [ ] Write pruning functions in `graph-pruning.ts` (pure, testable)
- [ ] Write tests for pruning functions
- [ ] Add `mode` prop to CausalGraph
- [ ] Implement embedded mode rendering (hide chrome, fit to container)
- [ ] Implement grouped node rendering
- [ ] Add zoom-to-fit on embedded mode render
- [ ] Verify canvas mode has no regressions
- [ ] Verify node click events work in both modes

## Notes

- Current `CausalGraph.tsx` uses D3 force-directed layout. For embedded mode, consider switching to a dagre/hierarchical layout for cleaner appearance in small spaces. This is optional — force-directed with zoom-to-fit may be sufficient.
- The pruning functions are the most testable part of this feature. Write them first with comprehensive tests, then integrate into the component.
- Edge contribution weights are in `chain.edges[].contributionWeight` and confidence in `chain.edges[].confidence`. These drive pruning decisions.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
