# Feature: Dynamic Context Card + Placeholder

**ID:** 02
**Status:** ✅ Completed
**Priority:** High
**Dependencies:** 01

## Description
Replace static portfolio summary card with a context card that adapts by page/entry context and set page-aware input placeholder text.

## Acceptance Criteria
- Welcome card title/content varies by page context.
- Placeholder is node-specific only for node entry.
- Sensible fallback text for missing data.

## Files to Modify
- `frontend/src/components/portfolio/AskPrismDrawer.tsx`
- `frontend/src/components/chat/ChatInput.tsx`
