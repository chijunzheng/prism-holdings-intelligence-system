# Feature: Ask Prism Entry Placement Alignment

**ID:** 01
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** -

## Description
Replace overlapping nav Ask Prism with the existing bottom-right Ask Prism FAB pattern and drawer behavior.

## Acceptance Criteria

- [x] Nav no longer renders Ask Prism button next to Notification Bell.
- [x] Impact Analysis renders the same bottom-right `ask-prism-fab` behavior as Portfolio.
- [x] Impact Analysis opens/closes `AskPrismDrawer` from FAB.
- [x] No auto-hijack of `askPrismOpen` into Strategy tab.
- [x] Tests/typecheck/build pass.

## Files to Modify

- `frontend/src/components/shared/AppLayout.tsx`
- `frontend/src/routes/ImpactAnalysisView.tsx`

## Verification

- `pnpm test`
- `pnpm --filter @prism/frontend exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @prism/frontend build`
