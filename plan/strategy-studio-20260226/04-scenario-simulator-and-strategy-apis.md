# Feature: Scenario Simulator and Strategy APIs

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 02, 03

## Description

Build backend strategy endpoints that create/update/evaluate scenarios and return baseline-vs-proposed impact deltas using existing exposure and temporal pipelines.

## Acceptance Criteria

- [ ] API can create a draft scenario from signal context
- [ ] API can apply scenario operations and return re-evaluation
- [ ] Evaluation includes downside reduction, diversification gain, turnover, and tax penalty fields
- [ ] Objective enforces 1-month downside minimization with 6-month guardrail
- [ ] Cash increase path exists for low-confidence regimes

## Implementation Details

### Files to Create/Modify

- Create: `agents/src/strategy-simulator/index.ts`
- Create: `agents/src/strategy-simulator/scoring.ts`
- Modify: `agents/src/orchestrator/index.ts`
- Modify: `server/src/index.ts`
- Create: `server/src/strategy-service.ts`

### API Surface (Proposed)

- `POST /api/strategy/:userId/draft`
- `POST /api/strategy/:userId/evaluate`
- `POST /api/strategy/:userId/command` (optional command-style mutation endpoint)

## Testing Requirements

- [ ] Server integration tests for draft/evaluate endpoints
- [ ] Unit tests for scoring and guardrail logic
- [ ] Regression tests ensuring existing impact endpoints remain unchanged

## Notes

- Keep first version stateless and request-scoped; add persistence later if needed.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
