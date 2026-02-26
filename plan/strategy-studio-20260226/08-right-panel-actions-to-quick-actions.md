# Feature: Drill-down Right Panel Simplification to Quick Actions

**ID:** 08
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 01, 05

## Description

Replace the overloaded right-panel `Actions` experience with concise `Quick Actions` that summarize options and route users into Strategy Studio for full scenario design.

## Acceptance Criteria

- [ ] Right panel tab naming updated from `Actions` to `Quick Actions` (or equivalent)
- [ ] Suggestions are concise and context-aware
- [ ] Each quick action has `Open in Strategy Studio` CTA
- [ ] No duplicated heavy strategy controls remain in Drill-down panel

## Implementation Details

### Files to Create/Modify

- Modify: `frontend/src/components/impact/ActionsPanel.tsx`
- Modify: `frontend/src/components/impact/RightPanel.tsx`
- Modify: `frontend/src/routes/impact/ImpactDrilldownView.tsx`
- Modify: `frontend/src/styles/impact-analysis.css`

## Testing Requirements

- [ ] Right-panel render and CTA wiring tests
- [ ] Navigation test from Drill-down to Strategy Studio with preserved context

## Notes

- Keep Drill-down optimized for understanding, not full strategy authoring.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
