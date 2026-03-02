# Feature: Cross-Signal Synthesizer

**ID:** 14
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 13 (Pipeline Orchestrator)
**Tier:** 5

## Description

Portfolio review mode: when 2+ signals are active, runs per-signal pipelines in parallel, then synthesizes across all FundManagerVerdicts. Computes interaction effects (offsetting/compounding), net vs gross impact, and holistic recommendations.

## Acceptance Criteria

- [ ] Runs N per-signal pipelines in parallel
- [ ] Classifies per-holding interactions: offsetting, compounding, independent
- [ ] Net impact < gross impact for offsetting signals
- [ ] Wider confidence range for compounding signals
- [ ] LLM generates plain-English interaction insights
- [ ] Holistic recommendations account for ALL signals (not per-signal)
- [ ] Flags when a hedge for Signal A increases exposure to Signal B
- [ ] "Do nothing" baseline shows cumulative cost across all signals
- [ ] Produces valid PortfolioVerdict

## Files to Create

- `agents/src/multi-agent/cross-signal-synthesizer.ts`
- `agents/src/multi-agent/__tests__/cross-signal-synthesizer.test.ts`

## Implementation Details

### Architecture

```
Signal 1 → runMultiAgentAnalysis() → Verdict 1 ─┐
Signal 2 → runMultiAgentAnalysis() → Verdict 2 ──┤→ synthesize() → PortfolioVerdict
Signal 3 → runMultiAgentAnalysis() → Verdict 3 ─┘
```

### Step 1: Aggregate Per-Holding Impacts (Pure Computation)

```typescript
function aggregateHoldingImpacts(
  verdicts: FundManagerVerdict[],
  correlationMatrix: number[][]
): HoldingNetImpact[] {
  // For each holding affected by multiple signals:
  const holdingMap = new Map<string, SignalContribution[]>()

  for (const verdict of verdicts) {
    for (const impact of verdict.holdingImpacts) {
      holdingMap.get(impact.ticker)?.push({
        signalId: verdict.signalId,
        impact: impact.dollarImpact,
      }) ?? holdingMap.set(impact.ticker, [{ signalId: verdict.signalId, impact: impact.dollarImpact }])
    }
  }

  return Array.from(holdingMap.entries()).map(([ticker, contributions]) => {
    const interaction = classifyInteraction(contributions)
    const netImpact = computeNetImpact(contributions, interaction)
    const grossImpact = computeGrossImpact(contributions)

    return { holdingTicker: ticker, signalContributions: contributions, interaction, netImpact, grossImpact }
  })
}
```

### Interaction Classification

```typescript
function classifyInteraction(contributions: SignalContribution[]): 'offsetting' | 'compounding' | 'independent' {
  if (contributions.length <= 1) return 'independent'

  const directions = contributions.map(c => Math.sign(c.impact.mid))
  const hasPositive = directions.some(d => d > 0)
  const hasNegative = directions.some(d => d < 0)

  if (hasPositive && hasNegative) return 'offsetting'
  return 'compounding'
}
```

### Net Impact Computation

```typescript
function computeNetImpact(contributions: SignalContribution[], interaction: string): DollarRange {
  const midSum = contributions.reduce((sum, c) => sum + c.impact.mid, 0)

  if (interaction === 'offsetting') {
    // Offsetting narrows uncertainty range
    return {
      low: midSum * 0.7,
      mid: midSum,
      high: midSum * 1.3,
    }
  } else if (interaction === 'compounding') {
    // Compounding widens uncertainty range
    return {
      low: midSum * 1.5,
      mid: midSum,
      high: midSum * 0.5,  // More negative
    }
  }
  // Independent: simple sum
  return { low: sumOf('low'), mid: midSum, high: sumOf('high') }
}
```

### Step 2: Generate Interaction Insights (LLM)

```typescript
async function generateInteractionInsights(
  holdingNetImpacts: HoldingNetImpact[],
  verdicts: FundManagerVerdict[]
): Promise<string[]> {
  // LLM: "The oil price drop partially offsets the rate hike impact on your energy holdings"
  // LLM: "Two signals compound on your bond exposure — higher combined risk"
  // Rank by dollar magnitude of interaction effect
}
```

### Step 3: Holistic Recommendations (LLM)

Recommendations that account for ALL signals simultaneously. Flag when a hedge for one signal increases exposure to another.

### Public API

```typescript
export async function runPortfolioReview(params: {
  signals: Signal[]
  portfolio: Portfolio
  userProfile: UserProfile
  exposureMap: ExposureMap
  onProgress?: (stage: string, data: unknown) => void
}): Promise<PortfolioVerdict>
```

## Testing Requirements

- [ ] 2 opposing signals on same holding → net < gross, interaction: 'offsetting'
- [ ] 2 compounding signals → interaction: 'compounding', wider range
- [ ] Per-signal pipelines run in parallel (wall-clock ≈ single signal)
- [ ] Gross vs net comparison produces meaningful difference
- [ ] Valid PortfolioVerdict output

## Implementation Checklist

- [ ] Implement aggregateHoldingImpacts (pure computation)
- [ ] Implement interaction classification
- [ ] Implement net vs gross computation
- [ ] Implement interaction insights (LLM)
- [ ] Implement holistic recommendations (LLM)
- [ ] Implement runPortfolioReview() public API
- [ ] Write unit tests with mock verdicts
- [ ] Export from index.ts
