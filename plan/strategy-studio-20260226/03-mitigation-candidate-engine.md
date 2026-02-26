# Feature: Mitigation Candidate Engine

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 02

## Description

Implement an agent/orchestrator module that generates ranked mitigation candidates (ETFs + stocks) from active signal context, user profile, and portfolio constraints.

## Acceptance Criteria

- [ ] Candidate generation returns 5 default recommendations (3 primary + 2 alternates)
- [ ] Universe includes ETFs and large-cap stocks only
- [ ] Excludes microcaps and disallowed instruments
- [ ] Applies risk-profile turnover and concentration constraints
- [ ] Includes confidence, rationale, and expected directional effect

## Implementation Details

### Files to Create/Modify

- Create: `agents/src/strategy-candidate-engine/index.ts`
- Create: `agents/src/strategy-candidate-engine/filter.ts`
- Create: `agents/src/strategy-candidate-engine/rank.ts`
- Modify: `agents/src/orchestrator/index.ts`
- Modify: `agents/src/index.ts`

### Key Components

1. Universe filter
- market cap and liquidity thresholds
- instrument exclusion policies

2. Constraint model
- risk-based turnover caps (3/5/7) with optional explicit override to 10

3. Ranking pipeline
- downside mitigation first, diversification bonus, cost penalties

## Testing Requirements

- [ ] Unit tests for filter logic and constraint gates
- [ ] Unit tests for ranking/scoring order
- [ ] Integration test via orchestrator with mock signal/exposure input

## Notes

- Start deterministic/rule-based before introducing heavier model-based ranking.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
