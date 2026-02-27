# Feature: Navigation & Routing Update

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** 02, 03

## Description

Update the top nav to show three tabs (Portfolio, Signals, Playbook) and wire all routes including the new views.

## Acceptance Criteria

- [ ] Three tabs visible: Portfolio, Signals, Playbook
- [ ] Active state highlights correctly on each tab
- [ ] Signals tab active on `/signals` and `/signals/:signalId` paths
- [ ] Playbook tab active on `/playbook`
- [ ] Portfolio tab active on `/portfolio`
- [ ] `/signals` routes to SignalsListView (not redirect)
- [ ] `/playbook` routes to PlaybookView
- [ ] All existing routes still work
- [ ] No dead routes or 404s

## Implementation Details

### Files to Modify

- `frontend/src/components/shared/AppLayout.tsx` — replace "Impact Analysis" NavLink with "Signals" and "Playbook"
- `frontend/src/App.tsx` — update route table

### Key Changes

1. **AppLayout.tsx nav update:**
   - Remove "Impact Analysis" NavLink
   - Add "Signals" NavLink to `/signals`
   - Add "Playbook" NavLink to `/playbook`

2. **App.tsx route update:**
   - `/signals` → `<SignalsListView />` (replaces redirect)
   - `/playbook` → `<PlaybookView />`
   - Keep existing: `/signals/:signalId`, `/signals/:signalId/plan`

## Dependencies

### Depends On
- **Feature 02:** SignalsListView must exist
- **Feature 03:** PlaybookView must exist

### Blocks
- Nothing — this is the final routing feature

## Implementation Checklist

- [ ] Update AppLayout.tsx nav tabs
- [ ] Update App.tsx routes
- [ ] Verify build compiles
- [ ] Test all navigation paths

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
