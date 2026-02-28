# Feature: Do-Nothing Comparison Bar

**ID:** 10
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Low
**Dependencies:** None
**Phase:** 3 — Conversational Planning
**Plan Reference:** J10

## Description

Always-visible comparison at the top of PlanView showing two paths side by side:
- "Without a plan: -$340" (red bar)
- "With this plan: -$90" (green bar, updates live as candidates change)
- Arrow or delta: "↑ saves you ~$250"

Users immediately see the value of their plan vs doing nothing.

## Acceptance Criteria

- [ ] Comparison bar visible at top of PlanView, always above candidate grid
- [ ] "Without a plan" shows `baselineOneMonthCad` from draft (the do-nothing loss)
- [ ] "With this plan" shows `proposedOneMonthCad` from evaluation (updates live)
- [ ] Delta shown: "saves you ~$X" when plan reduces loss
- [ ] Visual bars proportional to impact magnitude
- [ ] When no evaluation yet, only shows "Without a plan" baseline
- [ ] Dollar amounts rounded to nearest $10 with "~" prefix

## Implementation Details

### Files to Create

- `frontend/src/components/plan/DoNothingBar.tsx` — Comparison bar component

### Files to Modify

- `frontend/src/routes/signal/PlanView.tsx` — Add bar above candidate section

### DoNothingBar Component

```typescript
interface DoNothingBarProps {
  readonly baselineOneMonthCad: number    // From draft.baselineOneMonthCad
  readonly proposedOneMonthCad?: number   // From evaluation.proposedOneMonthCad
}
```

**Rendering logic:**
```typescript
const baseline = Math.round(baselineOneMonthCad / 10) * 10
const proposed = proposedOneMonthCad != null ? Math.round(proposedOneMonthCad / 10) * 10 : null
const savings = proposed != null ? Math.abs(baseline) - Math.abs(proposed) : null

// Bar widths proportional to magnitude
const maxMagnitude = Math.max(Math.abs(baseline), Math.abs(proposed ?? baseline))
const baselineWidth = (Math.abs(baseline) / maxMagnitude) * 100
const proposedWidth = proposed != null ? (Math.abs(proposed) / maxMagnitude) * 100 : 0
```

**Visual:**
```
Without a plan: ████████████████████ -$340
With this plan: █████               -$90
                ↑ saves you ~$250
```

### Style

- Two horizontal bars with labels
- Baseline bar: red-tinted (#fdf2f2 background, #dc2626 bar fill)
- Proposed bar: green-tinted (#f0faf4 background, #16a34a bar fill)
- Savings delta: bold text with up-arrow, green color
- Smooth width transition when evaluation updates (CSS `transition: width 0.5s`)

## Testing Requirements

- [ ] Unit test: Shows only baseline when no evaluation
- [ ] Unit test: Shows both bars and savings when evaluation present
- [ ] Unit test: Rounds to nearest $10
- [ ] Unit test: Bar widths proportional to magnitudes

## Implementation Checklist

- [ ] Create `DoNothingBar` component
- [ ] Add CSS with bar animations
- [ ] Integrate into PlanView above candidate section
- [ ] Wire to draft baseline and evaluation proposed values
- [ ] Write unit tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
