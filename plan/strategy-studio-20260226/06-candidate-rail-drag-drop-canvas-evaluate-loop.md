# Feature: Candidate Rail + Drag/Drop Canvas + Evaluate Loop

**ID:** 06
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 04, 05

## Description

Wire candidate retrieval, drag/drop interactions, and scenario evaluation loop so users can build and compare mitigation strategies visually.

## Acceptance Criteria

- [ ] Candidate rail loads ranked candidates from strategy draft API
- [ ] Users can drag/drop candidates onto scenario canvas
- [ ] Scenario operations update local draft state deterministically
- [ ] Evaluate action reruns backend simulation and updates compare panel
- [ ] Baseline vs proposed deltas are clearly shown

## Implementation Details

### Files to Create/Modify

- Create: `frontend/src/hooks/useStrategyDraft.ts`
- Create: `frontend/src/hooks/useScenarioEvaluation.ts`
- Modify: `frontend/src/components/strategy/CandidateRail.tsx`
- Modify: `frontend/src/components/strategy/ScenarioCanvas.tsx`
- Modify: `frontend/src/components/strategy/StrategyEvaluationPanel.tsx`
- Modify: `frontend/src/routes/impact/StrategyStudioView.tsx`

### UX Rules

- One draft scenario in MVP
- Five candidates default
- Explicit evaluate/refresh controls

## Testing Requirements

- [ ] Hook tests for draft/evaluation API interactions
- [ ] Drag/drop behavior tests (keyboard and pointer)
- [ ] Comparison rendering tests for deltas and warnings

## Notes

- Keep operation log visible for auditability and user trust.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
