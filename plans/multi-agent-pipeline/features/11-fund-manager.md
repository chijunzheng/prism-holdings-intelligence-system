# Feature: Fund Manager

**ID:** 11
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 09 (Researcher Debate), 10 (Risk Management Team)
**Tier:** 4

## Description

The synthesis agent — the "overall brain" that receives ALL outputs from prior teams and produces the final FundManagerVerdict. Uses a 5-step algorithm: start from debate resolution, apply risk adjustments, calibrate dollar impacts, generate recommendations, produce verdict.

## Acceptance Criteria

- [ ] Receives: InferredRiskProfile + DebateResolution + RiskChallenge + MagnitudeValidation + StressTestResult + UserExpectations
- [ ] Uses DebateResolution.refinedHoldingImpacts (NOT raw analyst outputs)
- [ ] Applies risk challenge haircut and magnitude validation bounds
- [ ] Generates per-horizon recommendations (1W/1M/6M)
- [ ] Always includes "Do nothing" as first option with cost of inaction
- [ ] Recommendations scaled by inferred risk tolerance
- [ ] Preserves dissenting views in perspectiveBreakdown
- [ ] `humanDecisionRequired: true` (literal, not optional)
- [ ] Uses human scenario preference from Checkpoint 2 to adjust confidence
- [ ] Produces valid FundManagerVerdict

## Files to Create

- `agents/src/multi-agent/fund-manager.ts`
- `agents/src/multi-agent/__tests__/fund-manager.test.ts`

## Implementation Details

### 5-Step Synthesis Algorithm

**Step 1: Start from DebateResolution**
```typescript
const refinedImpacts = debateResolution.refinedHoldingImpacts
// NOT the original analyst estimates — debate has already refined them
```

**Step 2: Apply risk adjustments**
```typescript
const adjustedConfidence = debateResolution.consensusConfidence
  * (1 + riskChallenge.recommendedConfidenceAdjustment)

// Apply magnitude bounds from validator
for (const impact of refinedImpacts) {
  const validation = magnitudeValidation.holdingValidations.find(v => v.ticker === impact.ticker)
  if (validation?.outOfBounds) {
    impact.magnitudeScore = validation.calibratedMagnitude
  }
}
```

**Step 3: Calibrate dollar impacts**
```typescript
const calibratedImpacts = refinedImpacts.map(impact =>
  calibrateImpact({
    holdingValueCad: getHoldingValue(impact.ticker),
    analystDirectionConsensus: impact.direction,
    analystMagnitudeConsensus: impact.magnitudeScore,
    riskChallengeHaircut: riskChallenge.recommendedConfidenceAdjustment,
    computedVolatility: marketData.volatilities[impact.ticker].monthly,
    historicalEventImpact: marketData.eventImpacts?.[impact.ticker]?.avgMove,
    timeHorizonMultiplier: getTimeMultiplier(horizon),
  })
)
```

**Step 4: Generate recommendations (LLM)**
Using Gemini Flash with structured output:
- Always include "Do nothing" first with cost of inaction
- 2-3 additional options (light/moderate/aggressive protection)
- Each option: description, estimated cost, projected risk reduction
- Recommendations scaled by risk tolerance (conservative → smaller shifts)
- Never a single "right answer" — always options with tradeoffs

**Step 5: Human scenario preference**
```typescript
if (humanScenarioPreference === 'downside') {
  // Use 5th percentile estimates (conservative)
  calibratedImpacts = usePercentile(stressTest, 0.05)
} else if (humanScenarioPreference === 'tail') {
  // Use 1st percentile (maximum caution)
  calibratedImpacts = usePercentile(stressTest, 0.01)
} else {
  // Use Monte Carlo median (default)
  calibratedImpacts = usePercentile(stressTest, 0.50)
}
```

### FundManagerVerdict Output

```typescript
type FundManagerVerdict = {
  signalId: string
  holdingImpacts: CalibratedHoldingImpact[]
  recommendations: Recommendation[]
  riskAdjustments: {
    confidenceHaircut: number
    magnitudeBoundsApplied: string[]
    scenarioPreference: string
  }
  perspectiveBreakdown: {
    bullCase: string
    bearCase: string
    unresolvedDisagreements: string[]
  }
  qualityScore: number
  humanDecisionRequired: z.literal(true)  // Always true
}
```

### Prompt Design

```
You are a Fund Manager synthesizing a multi-perspective analysis into a final verdict.

DEBATE RESOLUTION: {compacted debate outcome}
RISK CHALLENGE: {assumptions challenged + haircut}
MAGNITUDE VALIDATION: {bounds check results}
STRESS TEST: {Monte Carlo scenarios}
USER RISK PROFILE: {inferred + declared tolerance}
USER SITUATION: {personal context if provided}

Generate 3 recommendation options:
1. "Do nothing" — with cost of inaction (the calibrated mid estimate)
2. Light protection — minimal intervention
3. Balanced response — moderate protection

For each option: description, estimated cost, risk reduction, tradeoffs.
Scale recommendations to user's risk tolerance: {tolerance level}.

Never recommend a single "right answer." Present tradeoffs honestly.
Include humanDecisionRequired: true.
```

## Testing Requirements

- [ ] Valid FundManagerVerdict output from mock inputs
- [ ] "Do nothing" always first recommendation
- [ ] humanDecisionRequired is always true
- [ ] Calibrated impacts within historical volatility bounds
- [ ] Higher risk tolerance → more aggressive recommendation options
- [ ] Scenario preference affects confidence weights correctly

## Implementation Checklist

- [ ] Implement 5-step synthesis algorithm
- [ ] Implement recommendation generation with Gemini Flash
- [ ] Implement scenario preference adjustment
- [ ] Wire as LangGraph node
- [ ] Write unit tests with mock pipeline data
- [ ] Export fund manager node function
