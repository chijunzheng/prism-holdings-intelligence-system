# Feature: Ask Prism Entry Harmonization (Desktop + Mobile)

**ID:** 09
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 01

## Description

Unify chat entry behavior across Portfolio and Impact Analysis so desktop uses a single global Ask Prism entry while mobile adds a contextual FAB in Impact Analysis.

## Acceptance Criteria

- [ ] No duplicate standalone Ask Prism button added to desktop Impact Analysis
- [ ] Global entry remains consistent across app views
- [ ] Mobile Impact Analysis includes FAB to open contextual chat
- [ ] Chat scope is context-aware:
  - selected node -> node-scoped
  - no node -> signal/scenario scoped

## Implementation Details

### Files to Create/Modify

- Modify: `frontend/src/components/shared/AppLayout.tsx`
- Modify: `frontend/src/routes/impact/ImpactDrilldownView.tsx`
- Modify: `frontend/src/routes/impact/StrategyStudioView.tsx`
- Modify: `frontend/src/components/chat/ChatPanel.tsx`
- Modify: `frontend/src/styles/chat.css`
- Modify: `frontend/src/styles/impact-analysis.css`

## Testing Requirements

- [ ] Desktop entry uniqueness tests
- [ ] Mobile FAB visibility tests by viewport
- [ ] Context-scope tests for chat initialization

## Notes

- Maintain minimal chrome in busy analytical views.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
