# Feature: Playbook — Focused Decision Flow

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Redesign PlanView to follow Wealthsimple's focused decision flow pattern. Add signal context to the header (headline + impact). Make the reasoning graph section collapsible (collapsed by default with summary, expandable to full graph + path insight). Move "Add top 3" to bottom of candidates. More generous spacing throughout. Max-width ~1100px centered layout.

Principle: Given the signal impacts, recommend securities that help mitigate → explain why → let the user decide.

## Acceptance Criteria

- [ ] Header shows signal context: headline + estimated impact from the source signal
- [ ] Reasoning section collapsible: 1-2 line summary when collapsed, full graph + path insight when expanded
- [ ] Clicking graph node in expanded reasoning → path insight appears inline below graph
- [ ] "Add top 3 to scenario" moved to bottom of candidates list as a clear CTA
- [ ] 2-col layout for candidates + evaluation sidebar (1fr + 340px)
- [ ] Max-width ~1100px, centered, generous padding
- [ ] All cards: 14px border-radius, `--shadow-card`, Wealthsimple spacing
- [ ] Candidate cards, evaluation sidebar, confirmation modal all still work

## Implementation Details

### Files to Modify

- `frontend/src/routes/signal/PlanView.tsx` — Add signal context to header from `graphData.signal`. Add `reasoningExpanded` local state (default false). Render collapsible reasoning section. Move "Add top 3" chip to bottom of candidates. Restructure layout sections.
- `frontend/src/styles/plan.css` — Add `.plan-view__signal-context` styles. Add collapsible reasoning toggle styles (`.plan-view__reasoning--collapsed`, `--expanded`). Increase padding/gaps for Wealthsimple feel. Ensure max-width 1100px centering.

### Existing Components Reused (no changes)

- `CandidateCard` (`frontend/src/components/plan/CandidateCard.tsx`)
- `PlanEvaluationSidebar` (`frontend/src/components/plan/PlanEvaluationSidebar.tsx`)
- `PlanConfirmation` (`frontend/src/components/plan/PlanConfirmation.tsx`)
- `CausalGraph` — reasoning graph with `mode="embedded"`
- `AskPrismDrawer` + Ask Prism FAB
- `usePlan`, `useCausalChain`, `buildMitigationReasoningChain`

## Implementation Checklist

- [ ] Add signal context to PlanView header
- [ ] Implement collapsible reasoning section
- [ ] Add path insight below reasoning graph
- [ ] Move "Add top 3" to bottom of candidates
- [ ] Update plan.css for generous spacing
- [ ] Verify build passes
- [ ] Verify candidate Add/Remove/Allocation still works
- [ ] Verify Review → Confirmation modal flow

---

**Created:** 2026-02-27
