# Feature: Archive Plans Instead of Delete

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** None
**Phase:** 1 — Fix the Plumbing
**Plan Reference:** J13

## Description

Currently, plans can only be deleted (hard delete via `DELETE /api/plans/:userId/:sessionId`). Users lose their history. The backend plan session structure already supports a status field — wire up `archived` status so users can hide plans without losing them.

## Acceptance Criteria

- [ ] Playbook shows "Archive" button instead of "Delete" on plan cards
- [ ] Archived plans are hidden from the default view
- [ ] "Show past plans" toggle at bottom reveals archived plans
- [ ] Archived plans show with a muted visual style
- [ ] "Restore" button on archived plans returns them to active view
- [ ] No data is lost — archive is reversible

## Implementation Details

### Files to Modify

- `frontend/src/routes/PlaybookView.tsx` — Archive button, toggle, filtered views
- `server/src/index.ts` — `PATCH /api/plans/:userId/:sessionId` already supports status updates

### Backend

The existing `PATCH /api/plans/:userId/:sessionId` endpoint accepts `{ status }` in the body. Plan sessions already have a `status` field (`'draft' | 'reviewed'`). Extend to include `'archived'`.

Update `shared/src/types/` PlanSession status type to add `'archived'`.

### Frontend — PlaybookView Changes

1. **Replace Delete with Archive:**
   - Change "Delete" button action to `PATCH` with `{ status: 'archived' }` instead of `DELETE`
   - Remove the `window.confirm` for archive (it's reversible, no need for confirmation)

2. **Filter archived sessions:**
   ```typescript
   const activeSessions = sessions.filter(s => s.status !== 'archived')
   const archivedSessions = sessions.filter(s => s.status === 'archived')
   ```

3. **"Show past plans" toggle:**
   ```typescript
   const [showArchived, setShowArchived] = useState(false)
   ```
   Render a section divider: "Past Plans (N)" with a toggle button.

4. **Restore action:**
   - PATCH with `{ status: 'draft' }` to restore an archived plan

5. **Visual treatment:**
   - Archived cards: 60% opacity, greyed-out health badge

### Status Filter Update

Update `statusFilter` to include `'archived'`:
```typescript
statusFilter: 'all' | 'draft' | 'reviewed' | 'archived'
```

## Testing Requirements

- [ ] Unit test: Archive action sends PATCH with archived status
- [ ] Unit test: Archived plans hidden from default view
- [ ] Unit test: "Show past plans" reveals archived sessions
- [ ] Unit test: Restore action sends PATCH with draft status

## Implementation Checklist

- [ ] Update PlanSession status type to include `'archived'`
- [ ] Replace delete button/action with archive in PlaybookView
- [ ] Add `showArchived` toggle state
- [ ] Filter sessions into active/archived groups
- [ ] Add "Past Plans" section with toggle
- [ ] Add "Restore" button on archived plan cards
- [ ] Style archived cards with muted treatment
- [ ] Write unit tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
