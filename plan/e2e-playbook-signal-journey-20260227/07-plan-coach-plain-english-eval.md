# Feature: Plan Coach Inline Feedback + Plain-English Evaluation

**ID:** 07
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** None
**Phase:** 2 — AI Narration Layer
**Plan References:** A6, J9

## Description

Two related improvements to the plan building experience:

1. **A6 — Plan Coach:** After each candidate add/remove/allocation change, Prism provides a one-line coaching comment as a subtle annotation near the evaluation sidebar. Template-based (no LLM call), zero latency.

2. **J9 — Plain-English Evaluation:** Replace jargon-heavy evaluation metrics with conversational text. "Your plan reduces the estimated loss by about $250" instead of "Downside Reduction: $247.32."

## Acceptance Criteria

- [ ] Coaching comment appears after each plan change (add/remove/allocation change)
- [ ] Comments are contextual — different for add vs remove vs allocation changes
- [ ] Comments reference concrete dollar amounts and percentages
- [ ] Comment fades in, then auto-fades after 5 seconds or on next change
- [ ] Evaluation sidebar shows plain-English text alongside/instead of raw numbers
- [ ] No additional API calls — all frontend-only logic

## Implementation Details

### Files to Create

- `frontend/src/components/plan/coaching-utils.ts` — `generateCoachingComment()` function
- `frontend/src/components/plan/CoachingComment.tsx` — Display component

### Files to Modify

- `frontend/src/routes/signal/PlanView.tsx` — Integrate coaching + plain-English eval

### A6: Coaching Comment Logic

```typescript
// frontend/src/components/plan/coaching-utils.ts

interface CoachingInput {
  readonly action: 'add' | 'remove' | 'set_allocation'
  readonly ticker?: string
  readonly prevEvaluation: StrategyEvaluation | null
  readonly newEvaluation: StrategyEvaluation | null
  readonly selectionCount: number
}

export function generateCoachingComment(input: CoachingInput): string | null
```

**Template rules:**
- Add first candidate: "Good start — that alone reduces your risk by about ${delta}."
- Add 2nd: "Two positions give you broader coverage. Your plan now covers ~${pct}% of the downside."
- Add 3rd: "Three positions is a solid setup. Your plan now covers ~${pct}% of the estimated downside."
- Remove (coverage drops below 50%): "Without ${ticker}, your plan now covers about ${pct}% of the downside. You might want an alternative."
- Remove (still good): "Simpler plan — you're still covering ~${pct}% of the estimated loss."
- Allocation > 7%: "That's higher than typical — most plans use 3-5% for this type of position."
- Turnover > hardMaxTurnoverPct: "Heads up — your plan requires more trades than usual."
- Protection increased: "Nice — that improved your protection by ~${delta}."
- Objective satisfied: "Looking good — your plan meets the target."

**Calculation:** `coveragePct = (downsideReductionCad / Math.abs(baselineOneMonthCad)) * 100`

### CoachingComment Component

```typescript
interface CoachingCommentProps {
  readonly comment: string | null
}
```

- Small text bubble with Prism sparkle icon
- CSS `fadeIn` animation on mount, `fadeOut` after 5 seconds via `useEffect` timer
- Positioned near the evaluation sidebar

### J9: Plain-English Evaluation

Transform evaluation metrics in the sidebar:

| Raw Metric | Plain English |
|------------|---------------|
| `downsideReductionCad: 247.32` | "Reduces estimated loss by about $250" |
| `turnoverPct: 4.2` | "Requires 4% portfolio turnover (2 trades)" |
| `diversificationGain: 0.15` | "Improves your diversification slightly" |
| `taxPenaltyCad: 12` | "Estimated tax impact: ~$12" |
| `score: 72` | "Plan strength: Strong" |
| `objectiveSatisfied: true` | "Meets your protection target" |

Build a `formatEvaluationForDisplay()` utility:
```typescript
interface PlainEvaluation {
  readonly summary: string       // "Your plan reduces the estimated loss by about $250"
  readonly tradesSummary: string // "2 new positions, 4% portfolio change"
  readonly strengthLabel: string // "Strong" | "Good" | "Needs work"
  readonly warnings: ReadonlyArray<string>
}
```

## Dependencies

### Blocks
- **Feature 08 (Plan Wizard):** Step 3 uses plain-English evaluation for confirmation
- **Feature 18 (Plan Journey Polish):** Extends coaching comments and evaluation formatting

## Testing Requirements

- [ ] Unit test: `generateCoachingComment()` returns correct comment for each action type
- [ ] Unit test: Coverage percentage calculation is correct
- [ ] Unit test: `formatEvaluationForDisplay()` transforms all metric types correctly
- [ ] Unit test: Coaching comment auto-clears after timeout
- [ ] Unit test: Null returned when no meaningful comment (e.g., no evaluation available)

## Implementation Checklist

- [ ] Create `coaching-utils.ts` with `generateCoachingComment()`
- [ ] Create `formatEvaluationForDisplay()` utility
- [ ] Create `<CoachingComment>` component with fade animation
- [ ] Integrate coaching into PlanView (track prev/new evaluation)
- [ ] Replace evaluation sidebar metrics with plain-English text
- [ ] Write unit tests for both utilities
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
