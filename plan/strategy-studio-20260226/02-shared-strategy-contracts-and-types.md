# Feature: Shared Strategy Contracts and Types

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Define canonical shared types and schemas for mitigation candidates, scenario operations, strategy constraints, and evaluation results used by frontend, backend, and agents.

## Acceptance Criteria

- [ ] Strategy types are defined in shared package and exported
- [ ] Zod schemas validate strategy API payloads
- [ ] Frontend graph types include strategy payload types without duplication
- [ ] Server and agents compile against shared contracts

## Implementation Details

### Files to Create/Modify

- Create: `shared/src/types/strategy.ts`
- Modify: `shared/src/index.ts`
- Modify: `frontend/src/types/graph.ts`
- Modify: `agents/src/types.ts` (if needed for orchestration typing)

### Key Components

1. Candidate model
- security metadata, rationale, confidence, constraint flags

2. Scenario model
- operations (`add`, `remove`, `resize`, `replace`), constraint snapshot

3. Evaluation model
- baseline vs proposed deltas for impact, concentration, overlap, turnover, tax penalty

## Testing Requirements

- [ ] Shared type/schema tests in `shared/src/__tests__/types.test.ts`
- [ ] Contract compatibility checks in frontend and server builds

## Notes

- Keep contracts deterministic and versioned for future strategy model upgrades.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
