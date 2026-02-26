# Feature: Impact Analysis Shell Refactor (Subviews)

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** None

## Description

Refactor the overloaded `ImpactAnalysisView` into a stable shell with three subviews: `Overview`, `Drill-down`, and `Strategy Studio`, while preserving existing behavior for graph and chat interactions.

## Acceptance Criteria

- [ ] `Impact Analysis` supports subview switching without losing selected signal context
- [ ] Existing Drill-down graph and node interaction continues to function
- [ ] Shared state store is introduced for cross-subview continuity
- [ ] Subview routing/state does not break deep-linking by signal id

## Implementation Details

### Files to Create/Modify

- Modify: `frontend/src/routes/ImpactAnalysisView.tsx`
- Create: `frontend/src/routes/impact/ImpactOverviewView.tsx`
- Create: `frontend/src/routes/impact/ImpactDrilldownView.tsx`
- Create: `frontend/src/routes/impact/StrategyStudioView.tsx`
- Create: `frontend/src/contexts/ImpactAnalysisContext.tsx`
- Modify: `frontend/src/styles/impact-analysis.css`

### Key Components

1. `ImpactAnalysisContext`
- Shared selected signal, selected node, analysis mode, and subview state

2. `ImpactAnalysisView` shell
- Renders segmented subview nav and delegates content to child views

3. Subviews
- `Overview`: high-level summaries
- `Drill-down`: existing graph-first experience
- `Strategy Studio`: dedicated mitigation workspace entry

## Testing Requirements

- [ ] View-switch state persistence tests
- [ ] Regression tests for drill-down data load behavior
- [ ] Routing/deep-link tests for `signal` query param

## Notes

- This is the enabling refactor that reduces UI density before adding strategy features.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
