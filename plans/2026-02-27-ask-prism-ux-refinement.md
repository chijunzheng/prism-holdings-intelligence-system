# Ask Prism UX Refinement Plan

## Goal
Fix duplicated follow-up prompts, improve composer prominence, and make welcome context dynamic by entry page.

## Scope
- Ask Prism drawer rendering logic
- Chat input placeholder API and page-aware copy
- Drawer/composer styling adjustments
- Navigation/follow-up chip behavior and dedupe
- Frontend tests for helper logic

## Acceptance Criteria
- No repeated follow-up prompts on first open.
- Input composer is more visually prominent.
- Placeholder is page-aware and not always node-specific.
- Welcome context is dynamic by page/entry point.
- Suggested action chips remain route-aware and useful.
