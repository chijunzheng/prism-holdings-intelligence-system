# Feature: Composer Polish + Navigation Chip Polish + Tests

**ID:** 03
**Status:** ✅ Completed
**Priority:** High
**Dependencies:** 01, 02

## Description
Improve input dock prominence and refine navigation chip behavior while adding utility tests for new helper logic.

## Acceptance Criteria
- Composer visually stands out with improved spacing/contrast.
- Current-page navigation chip suppressed.
- Tests cover helper behavior (placeholder/context card/chip filtering).

## Files to Modify
- `frontend/src/styles/ask-prism-drawer.css`
- `frontend/src/styles/chat.css`
- `frontend/src/components/portfolio/AskPrismDrawer.tsx`
- `frontend/src/components/portfolio/__tests__/ask-prism-drawer-utils.test.ts`
