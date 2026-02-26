# Feature: Strategy Studio UI Skeleton

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 01, 02

## Description

Implement the initial Strategy Studio UI structure inside Impact Analysis with a three-pane layout and placeholder states wired to shared context.

## Acceptance Criteria

- [ ] Strategy Studio subview renders under Impact Analysis shell
- [ ] Three-pane layout exists: candidate rail, scenario canvas, evaluation panel
- [ ] Empty/loading/error states are implemented
- [ ] Context handoff from Drill-down signal selection works

## Implementation Details

### Files to Create/Modify

- Create: `frontend/src/components/strategy/StrategyStudioLayout.tsx`
- Create: `frontend/src/components/strategy/CandidateRail.tsx`
- Create: `frontend/src/components/strategy/ScenarioCanvas.tsx`
- Create: `frontend/src/components/strategy/StrategyEvaluationPanel.tsx`
- Modify: `frontend/src/routes/impact/StrategyStudioView.tsx`
- Modify: `frontend/src/styles/impact-analysis.css`
- Create: `frontend/src/styles/strategy-studio.css`

## Testing Requirements

- [ ] Render tests for Strategy Studio subview
- [ ] State hydration tests from ImpactAnalysisContext

## Notes

- Keep structure stable before wiring drag/drop and simulation data.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
