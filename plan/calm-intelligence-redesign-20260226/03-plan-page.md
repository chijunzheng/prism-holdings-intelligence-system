# Feature: Plan Page

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 02 (Signal Detail Page)

## Description

Card-based mitigation candidate selection page with a live sidebar evaluation. Replaces Strategy Studio. Entered via "Build a plan to reduce this risk →" from Signal Detail.

Key principle: **no command console, no sliders, no branches.** Users see candidate cards, toggle add/remove, and the sidebar evaluation updates live. The backend `strategy-candidate-engine` and `strategy-simulator` do all the heavy lifting behind a simple interface.

## Acceptance Criteria

- [ ] User clicks "Build a plan" on Signal Detail → lands on Plan page at `/signals/:signalId/plan`
- [ ] Page shows intro text: "Prism found N options. Add candidates to your plan, then review the evaluation."
- [ ] Each candidate card shows: instrument name, plain-language "offsets" explanation, trade-off, confidence, MER cost
- [ ] Cards have add/remove toggle with suggested allocation %
- [ ] Adding/removing a candidate triggers evaluation update in sidebar
- [ ] Sidebar shows: before/after impact, turnover %, tax impact, diversification delta
- [ ] Sidebar shows constraints with pass/fail indicators (turnover cap, max positions, 6M guardrail)
- [ ] "Review plan summary →" CTA opens human stop gate confirmation
- [ ] Confirmation modal shows: "Prism does not execute trades", plan summary, requires acknowledgment
- [ ] Back navigation returns to Signal Detail
- [ ] Persistent disclaimer visible

## Implementation Details

### Files to Create

- `frontend/src/routes/signal/PlanView.tsx` — route component
- `frontend/src/components/plan/CandidateCard.tsx` — individual candidate with add/remove
- `frontend/src/components/plan/PlanEvaluationSidebar.tsx` — live evaluation sidebar
- `frontend/src/components/plan/PlanConfirmation.tsx` — human stop gate modal
- `frontend/src/components/plan/ConstraintRow.tsx` — constraint with pass/fail indicator
- `frontend/src/styles/plan.css` — page styles
- `frontend/src/hooks/usePlan.ts` — plan state management + API calls

### Files to Modify

- `frontend/src/App.tsx` — add route `/signals/:signalId/plan`

### Key Components

1. **`PlanView.tsx`** — Route component
   - Receives `signalId` from URL params
   - On mount: calls `POST /api/strategy/:userId/draft` with signal context to get candidates
   - Manages plan state: which candidates are added, with what allocation
   - Layout: main (65%) + sidebar (35%)

2. **`CandidateCard.tsx`** — Candidate display
   - Header: instrument name + ticker
   - Body: "Offsets [risk type]" explanation in plain language, trade-off description
   - Footer: confidence badge, MER cost
   - Toggle: Add/Remove button. When added, shows allocation % (editable inline number, not slider)
   - Visual: added cards get subtle accent border, unadded cards are default

3. **`PlanEvaluationSidebar.tsx`** — Live evaluation
   - Header: "Plan Evaluation"
   - Before/After section:
     - 1M estimated impact: -$50 → -$28 (with arrow)
   - Metrics:
     - Turnover: 3.0%
     - Tax impact: ~$14
     - Diversification gain: +0.4
   - Constraints section (using `ConstraintRow`):
     - Turnover cap: 5% ✓
     - Max new positions: 2 ✓
     - 6M guardrail: Pass ✓
   - "Discuss with Prism →" link
   - Updates on every add/remove via `POST /api/strategy/:userId/evaluate`

4. **`PlanConfirmation.tsx`** — Human stop gate
   - Modal overlay triggered by "Review plan summary →"
   - Shows: signal context, selected candidates with allocations, evaluation summary
   - Warning: "Prism does not execute trades. This plan is for informational purposes only."
   - Buttons: "I understand" (closes modal, marks plan as reviewed) + "Go back"
   - After acknowledgment: show export/share options (future)

5. **`usePlan.ts`** — State management hook
   - State: `candidates` (from draft), `selections` (added candidates + allocations), `evaluation` (from evaluate endpoint)
   - `addCandidate(id, allocation)` — adds to selections, triggers re-evaluate
   - `removeCandidate(id)` — removes from selections, triggers re-evaluate
   - `updateAllocation(id, pct)` — updates allocation, triggers re-evaluate
   - Debounce evaluate calls (300ms) to avoid rapid-fire on allocation changes

### Data Flow

```
Enter from Signal Detail (carries signalId + signal context)
     │
     ├── POST /api/strategy/:userId/draft → candidates array
     │
     └── On each add/remove/change:
         POST /api/strategy/:userId/evaluate → evaluation scores
```

### Technical Decisions

- **No sliders:** Allocation is a small inline number input (e.g., "2%"). Sliders are imprecise and add visual complexity.
- **Debounced evaluation:** Each add/remove triggers an API call. Debounce at 300ms so rapid changes don't flood the server.
- **Suggested allocation:** Each candidate comes with a `suggestedAllocation` from the strategy engine. User sees this as default.
- **No branching/checkpoints:** Removed entirely. Plan state is ephemeral — if user navigates away, it resets. This is intentional simplicity for MVP.

## Dependencies

### Depends On
- **Feature 02:** Signal Detail Page — navigation flow enters Plan from Signal Detail

### Blocks
- **Feature 06:** Cleanup — old Strategy Studio can't be deleted until this replaces it

## Testing Requirements

- [ ] Unit tests: CandidateCard renders correctly, toggle works
- [ ] Unit tests: PlanEvaluationSidebar updates with new evaluation data
- [ ] Unit tests: usePlan hook manages state correctly (add/remove/update)
- [ ] Unit tests: PlanConfirmation modal shows correct summary
- [ ] Integration tests: draft endpoint returns candidates, evaluate endpoint returns scores
- [ ] Integration tests: adding candidate triggers evaluation update in sidebar
- [ ] E2E test: Signal Detail → Plan → add candidate → sidebar updates → review plan

## Security Considerations

- [ ] Validate signalId and candidate IDs
- [ ] Ensure user can only draft/evaluate their own portfolio
- [ ] Plan confirmation modal prevents accidental acknowledgment (require explicit button click)

## Implementation Checklist

- [ ] Create route and view component
- [ ] Build candidate card with add/remove toggle
- [ ] Build evaluation sidebar with live updates
- [ ] Build constraint rows with pass/fail
- [ ] Build human stop gate confirmation modal
- [ ] Wire usePlan hook with debounced evaluation
- [ ] Add styles following Wealthsimple visual pattern
- [ ] Write tests
- [ ] Verify back navigation to Signal Detail

## Notes

- The `POST /api/strategy/:userId/draft` endpoint already exists and returns candidates with rationale, costs, and confidence. No backend changes needed.
- The `POST /api/strategy/:userId/evaluate` endpoint already exists and returns turnover, tax, diversification, guardrail compliance. No backend changes needed.
- Future enhancement: export plan as PDF. Not in MVP scope.
- Future enhancement: persist plan state so user can return to it. Not in MVP scope.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
