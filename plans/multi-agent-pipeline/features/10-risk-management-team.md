# Feature: Risk Management Team

**ID:** 10
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 07 (Calibration Engine)
**Tier:** 3

## Description

3 sequential devil's advocate agents: Assumptions Challenger, Magnitude Validator, and Portfolio Stress Tester. They challenge, validate, and stress-test the pipeline's estimates using real market data.

## Acceptance Criteria

- [ ] Assumptions Challenger reviews all 4 analyst assumptions, finds counter-evidence, assigns `likelihoodOfBeingWrong`
- [ ] Magnitude Validator cross-references estimates against real historical volatility bounds
- [ ] Portfolio Stress Tester runs Monte Carlo simulation with real correlation matrix
- [ ] Stress test produces VaR (95%) and CVaR (99%) from 10,000 simulations
- [ ] Reversal probability computed from simulation outcomes
- [ ] All 3 agents run sequentially (challenger → validator → stress tester)
- [ ] Tests verify outputs are valid and within expected ranges

## Files to Create

- `agents/src/multi-agent/risk-team/assumptions-challenger.ts`
- `agents/src/multi-agent/risk-team/magnitude-validator.ts`
- `agents/src/multi-agent/risk-team/portfolio-stress.ts`
- `agents/src/multi-agent/risk-team/__tests__/risk-team.test.ts`

## Implementation Details

### Agent 1: Assumptions Challenger

```typescript
async function runAssumptionsChallenger(params: {
  analystAssessments: AnalystAssessment[]
  humanCorrection?: string  // From Checkpoint 1
}): Promise<RiskChallenge> {
  // For each analyst's top 2 assumptions:
  // - Find counter-evidence via Gemini Search
  // - Assign likelihoodOfBeingWrong (0-1)
  // - Produce recommendedConfidenceAdjustment (always negative)
}
```

Key prompt instruction: "Find genuine counter-evidence. Do not accept 'markets are uncertain' as a challenge."

If human correction provided: "The user has noted: [correction]. Factor this into your challenge."

### Agent 2: Magnitude Validator

```typescript
async function runMagnitudeValidator(params: {
  debateResolution: DebateResolution
  marketData: MarketDataBundle
}): Promise<MagnitudeValidation> {
  // For each holding impact estimate:
  // - Compare against 2x 30-day computed volatility
  // - Flag any estimate exceeding bounds
  // - Produce calibratedMidCad per holding
}
```

Hardcoded fallback bounds (if no market data):
- Equities: 5%/month
- Bonds: 2%/month
- Commodities: 8%/month
- Crypto: 15%/month

### Agent 3: Portfolio Stress Tester

```typescript
async function runPortfolioStressTester(params: {
  holdingImpacts: CalibratedHoldingImpact[]
  correlationMatrix: number[][]
  numSimulations?: number  // Default: 10,000
}): Promise<StressTestResult> {
  // Monte Carlo simulation using real correlation matrix
  // Returns: base case (50th %ile), downside (5th), tail risk (1st), reversal probability
}
```

### Monte Carlo Implementation

```typescript
function monteCarloSimulation(params: {
  holdings: { ticker: string; value: number; expectedReturn: number; volatility: number }[]
  correlationMatrix: number[][]
  numSimulations: number
}): SimulationResult {
  // 1. Cholesky decomposition of correlation matrix
  // 2. For each simulation:
  //    a. Generate correlated random normals
  //    b. Compute return for each holding: μ + σ * correlatedNormal
  //    c. Compute portfolio return: sum(holding.value * holdingReturn)
  // 3. Sort outcomes
  // 4. Extract percentiles: 50th (base), 5th (VaR), 1st (CVaR)
  // 5. Count positive outcomes → reversal probability
}
```

### Cholesky Decomposition

```typescript
function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length
  const L = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k]
      }
      if (i === j) {
        L[i][j] = Math.sqrt(matrix[i][i] - sum)
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j]
      }
    }
  }
  return L
}
```

### LangGraph Sequential Edges

```typescript
graph.addEdge("assumptions_challenger", "magnitude_validator")
graph.addEdge("magnitude_validator", "portfolio_stress")
```

## Testing Requirements

- [ ] Assumptions Challenger produces >=6 challenged assumptions across 4 analysts
- [ ] Magnitude Validator flags out-of-bounds estimates
- [ ] Monte Carlo with uncorrelated holdings: VaR < sum of individual VaRs
- [ ] Monte Carlo with perfectly correlated holdings: VaR ≈ sum of individual VaRs
- [ ] Reversal probability is between 0 and 1
- [ ] Base case (50th percentile) is between downside and reversal
- [ ] Cholesky decomposition of identity matrix = identity matrix

## Implementation Checklist

- [ ] Implement assumptions-challenger.ts with Gemini Search
- [ ] Implement magnitude-validator.ts with real volatility bounds
- [ ] Implement Cholesky decomposition
- [ ] Implement Monte Carlo simulation
- [ ] Implement portfolio-stress.ts
- [ ] Wire sequential edges in LangGraph
- [ ] Write unit tests
- [ ] Export risk team node functions
