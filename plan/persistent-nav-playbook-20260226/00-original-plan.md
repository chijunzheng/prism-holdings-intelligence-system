# Original Plan: Persistent Navigation Tabs + Playbook

Add three persistent top-level navigation tabs (Portfolio, Signals, Playbook), a Signals list view, a Playbook view for saved plans, server-side plan session persistence, and auto-save in the plan builder.

## Context

The app currently uses a progressive flow (Portfolio → Signal Detail → Plan) but the nav only shows "Portfolio" and a dead "Impact Analysis" tab. The user wants three persistent top-level tabs so users can freely navigate between them and return to saved plans.

This requires: (1) a Signals list view, (2) a Playbook view with saved plan cards, (3) server-side plan persistence, (4) auto-save in the plan builder.

## Changes

### 1. Shared Types — `shared/src/types/plan-session.ts` (NEW)
- `PlanSession` — id, userId, signalId, signalHeadline, status (draft/reviewed/archived), draft snapshot, selectedCandidateIds, scenario, evaluation, title, affectedExposures, createdAt, updatedAt
- `CreatePlanSessionRequest` — signalId, signalHeadline, optional title/exposures
- `UpdatePlanSessionRequest` — optional status, title, selectedCandidateIds, scenario, evaluation

### 2. Plan Session Service — `server/src/plan-session-service.ts` (NEW)
JSON file-based persistence at `.runtime/plan-sessions.json`, max 50 sessions per user

### 3. Server Endpoints — `server/src/index.ts` (MODIFY)
GET/POST /api/plans/:userId, GET/PATCH/DELETE /api/plans/:userId/:sessionId

### 4. Signals List View — `frontend/src/routes/SignalsListView.tsx` (NEW)
Full-page grid of all active signals

### 5. Playbook View — `frontend/src/routes/PlaybookView.tsx` (NEW)
Saved plan session cards with evaluation summaries

### 6. Navigation — `frontend/src/components/shared/AppLayout.tsx` (MODIFY)
Three tabs: Portfolio, Signals, Playbook

### 7. Routes — `frontend/src/App.tsx` (MODIFY)
Add /signals → SignalsListView, /playbook → PlaybookView

### 8. Plan Auto-Save — `frontend/src/hooks/usePlan.ts` (MODIFY)
Auto-save debounced at 1s, session restore from URL param

---

**Created:** 2026-02-26
