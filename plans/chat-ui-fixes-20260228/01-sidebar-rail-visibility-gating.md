# Feature: Sidebar Rail Visibility Gating

**ID:** 01
**Status:** ✅ Completed
**Priority:** High
**Dependencies:** None

## Description
Hide the collapsed mini-rail when the full left drawer is expanded. Show the mini-rail only when `sidebar=collapsed`.

## Acceptance Criteria
- [x] Full drawer open by default without mini-rail visible.
- [x] Mini-rail appears only in collapsed state.
- [x] Collapse/expand controls still work.

## Files
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/styles/app-shell.css`
