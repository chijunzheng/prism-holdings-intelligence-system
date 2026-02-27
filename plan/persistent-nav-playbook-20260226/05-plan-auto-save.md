# Feature: Plan Auto-Save & Session Restore

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 01, 03

## Description

Update usePlan hook to auto-save plan state to the server and restore from saved sessions when navigating from Playbook. Plans automatically persist so users can return to them later.

## Acceptance Criteria

- [ ] Building a plan auto-creates a session on first candidate add
- [ ] Every add/remove/allocation change triggers debounced auto-save (1s)
- [ ] Navigating to `/signals/:signalId/plan?sessionId=xxx` restores saved session state
- [ ] Restored state includes: candidates, selections, allocations, evaluation
- [ ] Confirming plan via PlanConfirmation updates status to 'reviewed'
- [ ] Auto-save doesn't block UI (fire-and-forget with error logging)

## Implementation Details

### Files to Modify

- `frontend/src/hooks/usePlan.ts` — add auto-save and session restore logic
- `frontend/src/routes/signal/PlanView.tsx` — minor update if needed for confirmation status

### Key Changes

1. **Session restore from URL param:**
   - Read `?sessionId` from `useSearchParams`
   - If present: `GET /api/plans/:userId/:sessionId` → restore draft, selections, evaluation
   - If absent: existing flow (POST strategy draft)

2. **Auto-create session:**
   - On first `addCandidate`, if no sessionId yet: `POST /api/plans/:userId` with signal context
   - Store returned sessionId in state

3. **Auto-save on state changes:**
   - After every evaluate response: `PATCH /api/plans/:userId/:sessionId` with current selections, scenario, evaluation
   - Debounced at 1s to avoid rapid-fire
   - Fire-and-forget (errors logged, don't block UI)

4. **Status update on confirm:**
   - PlanConfirmation "I understand" → `PATCH` status to 'reviewed'

### Technical Decisions

- **Debounce 1s for save, 300ms for evaluate:** Save is slower because it's less critical than live evaluation updates.
- **Fire-and-forget saves:** Auto-save failures don't disrupt the user experience.
- **Session creation deferred:** Don't create a session until user actually adds a candidate (avoids empty sessions).

## Dependencies

### Depends On
- **Feature 01:** Plan session CRUD endpoints
- **Feature 03:** Playbook navigation passes sessionId

### Blocks
- Nothing — this is the final feature

## Testing Requirements

- [ ] Auto-save triggers after candidate add
- [ ] Session restore loads correct state
- [ ] Debounce prevents rapid saves
- [ ] Confirmation updates status

## Implementation Checklist

- [ ] Add sessionId state and URL param reading to usePlan
- [ ] Add session restore logic
- [ ] Add auto-create on first add
- [ ] Add debounced auto-save after evaluations
- [ ] Update PlanConfirmation to patch status
- [ ] Verify build compiles
- [ ] Test full flow: create plan → navigate away → return from Playbook

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
