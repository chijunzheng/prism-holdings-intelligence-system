# Feature: Resume Plan Indicator on Signal Detail

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None
**Phase:** 1 — Fix the Plumbing
**Plan Reference:** F4

## Description

When a user has a saved plan session for a signal, there's no UI indicating it exists. The "Build a plan" CTA always says "Build" even when a plan already exists. Users lose track of their work.

Fix: Check for existing plan sessions for the current signal. Show "Resume your plan" with last-saved metadata instead of "Build a plan."

## Acceptance Criteria

- [ ] When a plan session exists for this signal, sidebar CTA says "Resume your plan →"
- [ ] Shows plan metadata: status (draft/reviewed), last updated timestamp
- [ ] When no plan exists, CTA still says "Build a plan to reduce this risk →"
- [ ] Clicking "Resume" navigates to `/signals/:signalId/plan?sessionId=:id` (restores session)
- [ ] If multiple sessions exist, uses the most recently updated one
- [ ] Loading state while checking for existing sessions

## Implementation Details

### Files to Modify

- `frontend/src/components/signal/SignalImpactSidebar.tsx` — Add session check + conditional CTA
- Possibly: new lightweight hook `useExistingPlanSession(userId, signalId)`

### Approach

**Option A — Inline fetch in sidebar:**
```typescript
const [existingSession, setExistingSession] = useState<PlanSession | null>(null)
const [checkingSession, setCheckingSession] = useState(true)

useEffect(() => {
  fetch(`/api/plans/${userId}?signalId=${signalId}`)
    .then(res => res.json())
    .then(sessions => {
      const latest = sessions
        .filter(s => s.signalId === signalId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      setExistingSession(latest ?? null)
    })
    .finally(() => setCheckingSession(false))
}, [userId, signalId])
```

**Option B — Custom hook (preferred):**
```typescript
// frontend/src/hooks/useExistingPlanSession.ts
export function useExistingPlanSession(userId: string, signalId: string) {
  // Returns { session: PlanSession | null, loading: boolean }
}
```

**Server side:** The existing `GET /api/plans/:userId` returns all sessions. Filtering client-side is fine for the prototype (few sessions per user). No new endpoint needed.

### CTA Rendering

```tsx
{checkingSession ? (
  <span className="signal-sidebar__cta-loading">Checking for plans...</span>
) : existingSession ? (
  <Link
    className="signal-sidebar__cta signal-sidebar__cta--resume"
    to={`/signals/${signalId}/plan?sessionId=${existingSession.id}`}
  >
    Resume your plan →
    <span className="signal-sidebar__cta-meta">
      {existingSession.status === 'reviewed' ? 'Reviewed' : 'Draft'} ·
      Updated {formatRelativeTime(existingSession.updatedAt)}
    </span>
  </Link>
) : (
  <Link className="signal-sidebar__cta" to={`/signals/${signalId}/plan`}>
    Build a plan to reduce this risk →
  </Link>
)}
```

### Technical Decisions

- **Client-side filtering vs server query param:** Client-side filtering is simpler for prototype. The `GET /api/plans/:userId` endpoint already returns all sessions.
- **Most recent session:** If multiple sessions exist for the same signal, show the most recently updated one.

## Dependencies

### Blocks
- **Feature 17 (Signal Journey Polish):** The "You're Covered" shield indicator depends on knowing if a reviewed plan exists

## Testing Requirements

- [ ] Unit test: Shows "Resume" CTA when session exists for signal
- [ ] Unit test: Shows "Build" CTA when no session exists
- [ ] Unit test: Uses most recently updated session when multiple exist
- [ ] Manual: Click "Resume" → lands on plan page with correct session restored

## Implementation Checklist

- [ ] Create `useExistingPlanSession` hook
- [ ] Update `SignalImpactSidebar` to use the hook
- [ ] Add conditional CTA rendering (Resume vs Build)
- [ ] Add relative time formatting for "Updated X ago"
- [ ] Style the resume CTA variant
- [ ] Write unit tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
