# Feature: Drawer State + Prompt Dedupe

**ID:** 01
**Status:** ✅ Completed
**Priority:** High
**Dependencies:** -

## Description
Ensure welcome prompts and persistent follow-up prompts do not render together when they represent the same content.

## Acceptance Criteria
- Only welcome prompts show before first turn.
- Follow-up chips show after first turn.
- No duplicated prompt chips in same viewport.

## Files to Modify
- `frontend/src/components/portfolio/AskPrismDrawer.tsx`
