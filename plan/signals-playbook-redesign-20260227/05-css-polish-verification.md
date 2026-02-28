# Feature: CSS Polish + Verification

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** 01, 02, 03, 04

## Description

Final CSS polish pass across both pages. Ensure consistent Wealthsimple design tokens, verify all routes work end-to-end, clean up unused CSS rules.

## Acceptance Criteria

- [ ] `pnpm build` passes with no errors
- [ ] Both pages use consistent spacing: 14px radius, `--shadow-card`, warm gray bg
- [ ] Responsive breakpoints work (900px, 640px)
- [ ] No unused CSS from old 3-col layout
- [ ] All verification checklist items pass (see below)

## Verification Checklist

1. `/signals` — 2-col layout, chip strip at top, combined impact + contribution table, sidebar
2. Click signal chip → `/signals/:signalId`, chip highlights, center updates
3. Signal detail: story + impact at top, Causal Map/Holdings/Sources tabs
4. Click graph node → Path Insight inline, "Discuss with Prism" opens drawer
5. Click "Build a Plan →" → navigates to `/signals/:signalId/plan`
6. Playbook: signal context in header, collapsible reasoning, full candidate cards, evaluation sidebar
7. Add/Remove candidates → evaluation updates
8. "Add top 3" at bottom of candidates works
9. Review plan → confirmation modal → confirmed banner
10. Browser back/forward preserves state
11. `/signals/:signalId/plan` → Playbook tab active in nav

## Implementation Checklist

- [ ] Audit CSS for unused rules
- [ ] Verify responsive breakpoints
- [ ] Run full verification checklist
- [ ] Build passes

---

**Created:** 2026-02-27
