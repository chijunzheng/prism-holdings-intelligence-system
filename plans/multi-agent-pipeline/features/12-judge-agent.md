# Feature: Judge Agent

**ID:** 12
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 11 (Fund Manager)
**Tier:** 4

## Description

Quality evaluator that scores the Fund Manager's synthesis on 5 dimensions. If quality < 0.65, loops back to Fund Manager with feedback (max 2 iterations).

## Acceptance Criteria

- [ ] Scores 5 dimensions: evidence grounding, assumption quality, magnitude calibration, internal consistency, completeness
- [ ] Each dimension scored 0-1
- [ ] Overall quality = weighted average of dimensions
- [ ] Convergence: quality >= 0.65 → proceed
- [ ] Below threshold + iteration < 2 → loop back with specific feedback
- [ ] Iteration >= 2 → proceed with best available, flag lower confidence
- [ ] JudgeVerdict includes per-dimension scores and feedback

## Files to Create

- `agents/src/multi-agent/judge.ts`
- `agents/src/multi-agent/__tests__/judge.test.ts`

## Implementation Details

### 5 Scoring Dimensions

| Dimension | What it checks | Weight |
|-----------|---------------|--------|
| Evidence grounding | Are sources cited? From search, not hallucinated? | 0.25 |
| Assumption quality | Were assumptions identified AND challenged? | 0.20 |
| Magnitude calibration | Are estimates within historical bounds? | 0.25 |
| Internal consistency | Do analysts agree on direction? Disagreements resolved? | 0.15 |
| Completeness | Were all affected holdings addressed? | 0.15 |

### Implementation

```typescript
async function runJudge(params: {
  verdict: FundManagerVerdict
  signal: Signal
  portfolio: Portfolio
  analystAssessments: AnalystAssessment[]
  iteration: number
}): Promise<JudgeVerdict> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0.1,  // Low temp for consistent scoring
  })

  // Prompt: evaluate the verdict on 5 dimensions, score each 0-1
  // If overall < 0.65, provide specific feedback for improvement

  return {
    evidenceGrounding: score1,
    assumptionQuality: score2,
    magnitudeCalibration: score3,
    internalConsistency: score4,
    completeness: score5,
    overallQualityScore: weightedAvg,
    convergenceReached: weightedAvg >= 0.65,
    feedback: weightedAvg < 0.65 ? specificFeedback : undefined,
  }
}
```

### LangGraph Conditional Edges

```typescript
graph.addConditionalEdges("judge", (state) => {
  const converged = state.judgeVerdict?.convergenceReached
  const maxIterations = state.synthesisRound >= 2

  if (converged || maxIterations) return "__end__"
  return "fund_manager"  // Loop back with feedback
})
```

### Fund Manager Re-Synthesis (on loop back)

When looped back, Fund Manager receives:
- Original inputs (same as before)
- Judge's feedback (specific issues to address)
- Previous verdict (to improve upon, not start from scratch)

## Testing Requirements

- [ ] Well-formed verdict → quality >= 0.65, convergenceReached: true
- [ ] Verdict missing sources → evidence grounding < 0.5
- [ ] Verdict with 0 assumptions challenged → assumption quality < 0.5
- [ ] Verdict with out-of-bounds estimates → magnitude calibration < 0.5
- [ ] Feedback is specific when quality < 0.65

## Implementation Checklist

- [ ] Implement judge scoring with Gemini Flash
- [ ] Implement convergence check
- [ ] Implement feedback generation for sub-threshold verdicts
- [ ] Wire conditional edges for loop
- [ ] Write unit tests
- [ ] Export judge node function
