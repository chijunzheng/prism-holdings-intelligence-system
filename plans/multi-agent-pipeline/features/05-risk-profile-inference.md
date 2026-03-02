# Feature: Risk Profile Inference

**ID:** 05
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** 01 (Types and Schemas)
**Tier:** 1

## Description

Pure computation agent (no LLM) that infers a user's actual risk tolerance from their portfolio composition. Respects user-declared overrides when provided. Flags mismatches between inferred and declared risk levels.

## Acceptance Criteria

- [x] Scores risk 0-100 based on portfolio factors
- [x] Maps score to low/moderate/high tolerance
- [x] Respects `userExpectations.riskToleranceOverride` when set
- [x] Flags mismatch when declared != inferred (e.g., Diana: declared low but portfolio says high)
- [x] Identifies FHSA time-horizon mismatch (Sarah: 2yr horizon with 100% equities)
- [x] Detects duplicate holdings across accounts (Sarah: XIC + VFV in TFSA + FHSA)
- [x] Produces `InferredRiskProfile` with reasoning for each factor
- [x] Unit tests pass for all 3 demo profiles (12 tests)

## Files to Create

- `agents/src/multi-agent/risk-profile-inference.ts`
- `agents/src/multi-agent/__tests__/risk-profile-inference.test.ts`

## Implementation Details

### Scoring Factors (0-100 composite, starting at 50)

| Factor | Signal | Score Effect |
|--------|--------|-------------|
| Equity allocation >80% | Risk-seeking | +15 |
| Equity allocation >95% | Very risk-seeking | +25 |
| Fixed income >40% | Conservative | -15 |
| 2+ high/critical concentration warnings | Implicit risk acceptance | +10 |
| Investment horizon >20y | Can absorb volatility | +10 |
| Horizon <10y | Needs stability | -10 |
| Commodity/gold >10% | Defensive positioning | -5 |
| Tax-sheltered >80% | Conservative optimization | -5 |
| Single stock >20% of portfolio | Concentrated bet | +10 |
| No bonds at all | Very aggressive | +15 |
| FHSA with 100% equity and <5yr horizon | Critical mismatch | Flag as WARNING |

### Tolerance Mapping
- 0-33: low
- 34-66: moderate
- 67-100: high

### Expected Results for Demo Profiles

**Marcus (marcus-01):** Score ~90 (extremely high)
- 100% equity (+15), no bonds (+15), single stock NVDA >20% (+10), 30yr horizon (+10), 0% fixed income
- Tolerance: high

**Sarah (sarah-01):** Score ~55 (moderate)
- ~70% equity, ~15% bonds, 20yr horizon (+10), FHSA WARNING (2yr horizon, 100% equity in FHSA)
- Tolerance: moderate

**Diana (diana-01):** Score ~35 (low-moderate) BUT mismatch flag
- ~35% bonds (-15), 7yr horizon (-10), 58% financials concentration (+10)
- Declared: low → MISMATCH: "Portfolio concentration suggests higher risk acceptance than declared"

### Mismatch Detection
```typescript
if (declared && Math.abs(inferredScore - declaredScore) > 25) {
  mismatch = {
    declared: userExpectations.riskToleranceOverride,
    inferred: inferredTolerance,
    explanation: "Your portfolio suggests [X] risk tolerance, but you've indicated [Y]."
  }
}
```

## Testing Requirements

- [x] Marcus → score 80-100, tolerance: high
- [x] Sarah → score 45-65, tolerance: moderate, FHSA WARNING
- [x] Diana → score 35-65, tolerance: moderate, MISMATCH detected with declared "low"
- [x] Override: when declared is set, output uses declared but shows both
- [x] Empty portfolio → score 50 (neutral) — fixed "no bonds" false flag for empty portfolio

## Implementation Checklist

- [x] Implement scoring function (buildScoringContext + computeFactors)
- [x] Implement tolerance mapping (scoreToTolerance)
- [x] Implement mismatch detection (declared vs inferred with 25-point threshold)
- [x] Implement FHSA time-horizon check (detectWarnings)
- [x] Implement duplicate holdings detection across accounts
- [x] Write unit tests for all 3 profiles (12 tests passing)
- [x] Export inferRiskProfile from module
