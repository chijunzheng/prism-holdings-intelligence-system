# Feature: Additive SSE Events (Analyze API)

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** High
**Dependencies:** 01

## Acceptance Criteria
- Emit `impact_delta`, `playbook`, and `trace_step` events for single-signal analysis.
- Preserve existing event contract and complete payload.
- Frontend consumes these events progressively.
