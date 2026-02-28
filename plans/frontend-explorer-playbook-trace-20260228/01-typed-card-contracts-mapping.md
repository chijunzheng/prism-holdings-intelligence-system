# Feature: Typed Card Contracts + Mapping

**ID:** 01
**Status:** 🔄 In Progress
**Priority:** High
**Dependencies:** -

## Acceptance Criteria
- Add discriminated card union for chat cards.
- Eliminate `type: string` / `data: unknown` in `ChatArea` core flow.
- Introduce deterministic helpers to map verdict/brief/events into card payloads.
