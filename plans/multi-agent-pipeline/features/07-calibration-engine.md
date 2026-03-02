# Feature: Calibration Engine

**ID:** 07
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 04 (Market Data Service)
**Tier:** 2

## Description

Formula-based dollar impact calibration that converts LLM qualitative assessments into bounded, defensible dollar ranges using real market data. The LLM never picks dollar amounts — this formula does.

## Acceptance Criteria

- [x] `calibrateImpact()` converts qualitative magnitude (0-1) + direction into dollar range
- [x] Dollar range bounded by ±2x computed monthly volatility × holding value
- [x] When historical event impact data available (n>=5), anchors to that instead of generic bounds
- [x] Risk challenge haircut applied to reduce overconfidence
- [x] Time horizon multiplier scales impact correctly (1W < 1M < 6M)
- [x] No holding impact exceeds holding value (hard ceiling via clampToHoldingValue)
- [x] Unit tests verify all calibration behaviors (14 tests)

## Files to Create

- `agents/src/multi-agent/calibration.ts`
- `agents/src/multi-agent/__tests__/calibration.test.ts`

## Implementation Details

### Core Formula

```typescript
function calibrateImpact(params: {
  holdingValueCad: number
  analystDirectionConsensus: number      // -1 to +1
  analystMagnitudeConsensus: number      // 0 to 1
  riskChallengeHaircut: number           // -0.3 to 0
  computedVolatility: number             // REAL from Yahoo Finance
  historicalEventImpact?: number         // Average move on similar events
  timeHorizonMultiplier: number          // 1W: 0.25, 1M: 1.0, 6M: 2.5
}): DollarRange {
  // 1. Apply haircut to magnitude
  const adjustedMagnitude = magnitude * (1 + haircut)

  // 2. Compute raw impact
  const rawImpact = holdingValue * adjustedMagnitude * direction * timeMultiplier

  // 3. Compute bounds from real volatility
  const maxMove = 2 * computedVolatility * holdingValue * timeMultiplier

  // 4. Anchor to historical event impact if available
  if (historicalEventImpact && sampleSize >= 5) {
    midEstimate = holdingValue * historicalEventImpact * direction
  }

  // 5. Clamp to bounds
  const mid = clamp(rawImpact, -maxMove, maxMove)
  const low = mid * 0.5   // Conservative end
  const high = mid * 1.8  // Upper bound (clamped by volatility)

  // 6. Hard ceiling: can't exceed holding value
  return clampToHoldingValue({ low, mid, high }, holdingValue)
}
```

### Time Horizon Multipliers

| Horizon | Multiplier | Rationale |
|---------|-----------|-----------|
| 1 week | 0.25 | ~5 trading days out of 21 |
| 1 month | 1.0 | Base period (matches monthly vol) |
| 6 months | 2.5 | sqrt(6) ≈ 2.45, rounded |

### Portfolio-Level Aggregation

```typescript
function aggregateHoldingImpacts(
  holdingImpacts: CalibratedHoldingImpact[],
  correlationMatrix: number[][]
): DollarRange {
  // Simple sum for mid
  const midSum = sum(impacts.map(i => i.mid))

  // Correlated sum for low/high (wider if correlated, narrower if diversified)
  // Using portfolio variance formula: σ_p² = Σ Σ w_i w_j σ_i σ_j ρ_ij
  const portfolioVariance = computeCorrelatedVariance(impacts, correlationMatrix)
  const portfolioStdDev = Math.sqrt(portfolioVariance)

  return {
    low: midSum - 1.5 * portfolioStdDev,
    mid: midSum,
    high: midSum + 1.5 * portfolioStdDev,
  }
}
```

## Testing Requirements

- [x] Zero magnitude → $0 impact (toBeCloseTo for floating point)
- [x] Maximum magnitude (1.0) → capped at 2x monthly vol × holding value
- [x] Negative direction × positive magnitude → negative dollar impact
- [x] Haircut of -0.2 reduces impact by 20% (test uses magnitude=0.03 to stay within vol cap)
- [x] Historical event anchor overrides generic volatility when n>=5
- [x] Impact never exceeds holding value (extreme volatility test)
- [x] Portfolio aggregation: uncorrelated holdings → narrower range than correlated

## Implementation Checklist

- [x] Implement `calibrateImpact()` function
- [x] Implement `aggregateHoldingImpacts()` with correlation matrix
- [x] Implement `calibrateAllHoldings()` batch function with derivation strings
- [x] Implement time horizon multipliers (getTimeMultiplier)
- [x] Implement bounds clamping (clampToHoldingValue)
- [x] Write unit tests (14 tests passing)
- [x] Export from calibration module
