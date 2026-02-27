# Feature: Plan Session Types & Persistence Service (Backend)

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Create shared types for plan sessions and a JSON file-based persistence service on the server, with RESTful CRUD endpoints. This enables users to save, retrieve, and resume mitigation plans from the Playbook tab.

## Acceptance Criteria

- [ ] `PlanSession`, `CreatePlanSessionRequest`, `UpdatePlanSessionRequest` Zod schemas exist in shared types
- [ ] Plan session service persists to `.runtime/plan-sessions.json`
- [ ] `GET /api/plans/:userId` returns all non-archived sessions sorted by updatedAt desc
- [ ] `GET /api/plans/:userId/:sessionId` returns a single session
- [ ] `POST /api/plans/:userId` creates a new session with status 'draft'
- [ ] `PATCH /api/plans/:userId/:sessionId` updates session fields and bumps updatedAt
- [ ] `DELETE /api/plans/:userId/:sessionId` removes session
- [ ] Max 50 sessions per user, oldest pruned on write
- [ ] Sessions persist across server restarts

## Implementation Details

### Files to Create

- `shared/src/types/plan-session.ts` — Zod schemas for PlanSession, CreatePlanSessionRequest, UpdatePlanSessionRequest
- `server/src/plan-session-service.ts` — JSON file-based CRUD service

### Files to Modify

- `shared/src/index.ts` — add `export * from './types/plan-session'`
- `server/src/index.ts` — add 5 RESTful endpoints after strategy endpoints (~line 680)

### Key Components

1. **`plan-session.ts` (shared types)**
   - `PlanSession`: id, userId, signalId, signalHeadline, createdAt, updatedAt, status (draft/reviewed/archived), draft (nullable StrategyDraft), selectedCandidateIds, scenario (nullable), evaluation (nullable), title, affectedExposures
   - `CreatePlanSessionRequest`: signalId, signalHeadline, optional title/exposures
   - `UpdatePlanSessionRequest`: optional status, title, selectedCandidateIds, scenario, evaluation

2. **`plan-session-service.ts`**
   - JSON file at `.runtime/plan-sessions.json`
   - Functions: `listPlanSessions`, `getPlanSession`, `createPlanSession`, `updatePlanSession`, `deletePlanSession`
   - Lazy-load store on first access
   - Max 50 sessions per user (pruned on write)
   - Pattern follows existing `workspace-session-service.ts`

3. **Server endpoints**
   - `GET /api/plans/:userId` — list
   - `GET /api/plans/:userId/:sessionId` — get
   - `POST /api/plans/:userId` — create
   - `PATCH /api/plans/:userId/:sessionId` — update
   - `DELETE /api/plans/:userId/:sessionId` — delete

### Technical Decisions

- **JSON file storage:** Same pattern as workspace-session-service. No database needed for prototype.
- **Zod validation on load:** Parse stored sessions through Zod on read to handle schema evolution gracefully.
- **Immutable store updates:** All mutations create new store objects, never mutate in place.

## Dependencies

### Depends On
- Nothing — this is a foundation feature

### Blocks
- **Feature 03:** Playbook View needs endpoints to fetch saved plans
- **Feature 05:** Plan Auto-Save needs endpoints to create/update sessions

## Testing Requirements

- [ ] Unit tests: CRUD operations work correctly
- [ ] Unit tests: pruning at 50 sessions
- [ ] Integration tests: endpoints return correct HTTP status codes
- [ ] Integration tests: persistence survives service restart

## Security Considerations

- [ ] Validate userId parameter matches session ownership
- [ ] Validate request bodies with Zod schemas
- [ ] Don't expose other users' sessions

## Implementation Checklist

- [ ] Create plan-session.ts shared types
- [ ] Export from shared/src/index.ts
- [ ] Create plan-session-service.ts
- [ ] Add server endpoints
- [ ] Verify build compiles
- [ ] Test with curl

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
