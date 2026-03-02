# Risk Management Team: Assumptions Challenge & Magnitude Validation

**Status:** Production Ready
**Pattern:** 3-agent parallel risk validation (assumptions challenger, magnitude validator, stress tester)
**Key Innovation:** Devil's advocate + real historical volatility bounds prevent analyst groupthink

---

## Overview

After the **Debate** phase produces consensus, the **Risk Management Team** performs sanity checks:

1. **Assumptions Challenger** — Find counter-evidence to analyst assumptions (devil's advocate)
2. **Magnitude Validator** — Verify estimates don't exceed historical market moves (2x volatility bound)
3. **Portfolio Stress Tester** — Run Monte Carlo simulations to compute Value-at-Risk scenarios

**Without Risk Team:**
- Analysts reach consensus: "Oil down 15%, VFV down 0.5"
- Fund manager accepts this → recommendations built on assumption
- Problem: Consensus can be wrong if all analysts make same error

**With Risk Team:**
1. Challenger finds: "OPEC has announced production cuts planned"
2. Magnitude validator warns: "15% oil move is 3x recent volatility"
3. Stress tester shows: "Tail risk scenario -$600 if correlation spikes"
4. Fund manager now recommends: "Hedges available if user wants tail protection"

---

## Three-Agent Structure

### Agent 1: Assumptions Challenger (LLM-Based)

**Purpose:** Devil's advocate — find real counter-evidence to each analyst's key assumptions

**Input:**
```typescript
{
  analystAssessments: [
    {
      analystType: "macro",
      overallDirection: "negative",
      overallConfidence: 0.7,
      keyAssumptions: [
        "Central banks maintain restrictive stance through 2024",
        "Recession probability 35-40%",
        "Credit spreads widen 50-75 bps",
        "Corporate earnings fall 10-15% YoY"
      ],
      reasoning: "Inflation sticky, wage growth elevated..."
    },
    // ... 3 more analysts
  ],
  humanCorrection?: "OPEC meeting signals production cuts"
}
```

**Process:**
1. **Build prompt** — Format analyst assessments as adversarial brief
2. **Call Gemini with Search** — Find real counter-evidence online
3. **Extract challenges** — Parse "challenged assumptions" with evidence
4. **Compute confidence haircut** — How much less confident should we be? (-10% to -50%)

**Key constraint:** Challenges must cite **real evidence**, not speculation:
- ❌ "Markets are uncertain" (too generic)
- ✓ "ECB just signaled rate cuts ahead of Fed" (specific, time-bound)
- ✓ "Oil inventories hit 10-year highs last week" (verifiable)

**Output:**
```typescript
interface RiskChallenge {
  readonly challengedAssumptions: Array<{
    readonly assumption: string
    readonly counterEvidence: string
    readonly implication: string
  }>
  readonly recommendedConfidenceAdjustment: number  // -0.1 to -0.5
  readonly overallAssessment: string
}
```

**Example:**
```
Original: "Central banks maintain restrictive stance through 2024"
Counter-evidence: "ECB just signaled rate cuts in H2 2024; Fed market pricing shows 2-3 cuts by year-end"
Implication: "Banks may ease sooner than analyst assumed; bond upside potential higher"
Adjustment: -0.15 (80 basis points of confidence haircut)
```

### Agent 2: Magnitude Validator (Pure Computation + LLM)

**Purpose:** Flag estimates that exceed market reality (2x historical volatility)

**Process:**

#### Phase 1: Pure Computation
```typescript
for each holding:
  monthlyVol = historical volatility from Yahoo Finance (or fallback)
  maxReasonableMove = 2 × monthlyVol   // 2x is hard bound
  estimatedMagnitude = analyst's magnitude score (0-1)

  if estimatedMagnitude > maxReasonableMove:
    flag as "out of bounds"
    clamp to maxReasonableMove
  else:
    accept estimate as-is
```

**Example:**
```
VFV (S&P 500 ETF):
  Historical monthly volatility: 3.5%
  Analyst estimate: 8% move
  2x bound: 7%

  Status: OUT OF BOUNDS
  Reason: 8% > 7% (exceeds 2x volatility)
  Action: Clamp to 7% for recommendations
```

#### Phase 2: LLM Assessment (Optional)
For estimates flagged as out-of-bounds, optionally call Gemini to explain:
```
"Why might this move exceed historical volatility?"
- Tail risk scenario (market stress)?
- Unique event with no historical precedent?
- Compounding effects from multiple signals?
```

**Output:**
```typescript
interface MagnitudeValidation {
  readonly holdingValidations: Array<{
    ticker: string
    estimatedMagnitude: number
    historicalVolatility: number
    maxReasonableMove: number
    outOfBounds: boolean
    calibratedMagnitude: number  // Clamped value if out of bounds
  }>
  readonly outOfBoundsFlags: string[]
  readonly overallAssessment: string
}
```

**Example:**
```
VFV: estimated 8% → clamped to 7% (exceeds 2x monthly volatility)
TSX: estimated 6% → accepted (within bounds)
XEG: estimated 15% → clamped to 13% (commodity volatility is 6.5%, 2x = 13%)
```

### Agent 3: Portfolio Stress Tester (Pure Computation)

**Purpose:** Run Monte Carlo simulation to compute portfolio Value-at-Risk (VaR) scenarios

**Methodology:**
```
1. Build correlation matrix from 2 years of price history
2. Infer scenarios:
   - Base case: analyst consensus plays out
   - Downside: volatility -1σ, correlations increase
   - Tail risk: volatility -2.5σ, "crisis" correlation regime
3. Run 10,000 simulations per scenario
4. Compute portfolio impact: 5th, 25th, 50th, 75th, 95th percentiles
5. Report VaR (95%), CVaR (99%)
```

**Output:**
```typescript
interface StressTest {
  readonly scenarios: {
    readonly base: ScenarioResult
    readonly downside: ScenarioResult
    readonly tailRisk: ScenarioResult
  }
}

interface ScenarioResult {
  readonly description: string      // "Market correlation normal"
  readonly multiplier: number       // 1.0x, -1σ, -2.5σ
  readonly portfolioImpact: DollarRange
  readonly affectedHoldings: Array<{
    ticker: string
    impact: DollarRange
  }>
  readonly var95: number            // 95% VaR
  readonly cvar99: number           // 99% CVaR (tail risk)
}
```

**Example:**
```
Scenario: Base Case
├─ Market plays out as analyst consensus
├─ Portfolio impact: -$200 to -$50 (mid: -$120)
├─ VaR 95%: -$180 (worst case 5% of time)
└─ CVaR 99%: -$250 (average of worst 1%)

Scenario: Downside (-1σ)
├─ Correlation amplifies: equities fall together
├─ Portfolio impact: -$400 to -$150 (mid: -$280)
├─ VaR 95%: -$350
└─ CVaR 99%: -$420

Scenario: Tail Risk (-2.5σ)
├─ Crisis regime: everything falls
├─ Portfolio impact: -$600 to -$300 (mid: -$450)
├─ VaR 95%: -$550
└─ CVaR 99%: -$620
```

---

## Parallel Execution

All three agents run **in parallel** after Checkpoint 1:

```
Checkpoint 1 (Debate complete)
  ↓
┌─────────────────────────────────────┐
│  Risk Management Team (Parallel)    │
├─────────────────────────────────────┤
│ ├─ Assumptions Challenger (1.0s)   │
│ ├─ Magnitude Validator (0.5s)       │
│ └─ Portfolio Stress Tester (1.5s)   │
└─────────────────────────────────────┘
  ↓
Max(1.0, 0.5, 1.5) = 1.5s wall-clock time
  ↓
Soft Checkpoint: "Risk challenges identified"
  ↓
Fund Manager (synthesis with all risk insights)
```

**LangGraph pattern:**
```typescript
.addEdge('checkpoint_1', 'assumptions_challenger')
.addEdge('checkpoint_1', 'magnitude_validator')
.addEdge('checkpoint_1', 'portfolio_stress')

// All three must finish before proceeding
.addEdge('assumptions_challenger', 'fund_manager')
.addEdge('magnitude_validator', 'fund_manager')
.addEdge('portfolio_stress', 'fund_manager')
```

---

## Data Flow: Risk Insights → Fund Manager

### Fund Manager Input

After risk team completes, fund manager receives:

```typescript
interface RiskInsights {
  // From assumptions challenger
  challengedAssumptions: RiskChallenge

  // From magnitude validator
  magnitudeValidation: MagnitudeValidation

  // From stress tester
  stressTest: StressTest
}
```

### Fund Manager Decision-Making

Fund manager uses risk insights to:

1. **Adjust consensus** — If challenger found strong counter-evidence, revise direction/confidence
2. **Recalibrate magnitudes** — Use clamped values from validator instead of analyst estimates
3. **Build risk-adjusted recommendations** — Account for multiple scenarios from stress test

**Example:**
```
Analyst consensus: VFV -$300 (15% move in oil)

After risk team:
├─ Challenger: "OPEC cuts signal; oil movement uncertain"
├─ Validator: "15% move exceeds 2x volatility; clamp to 10%"
└─ Stress test: Shows -$600 in tail risk scenario

Fund manager revision:
├─ Original: VFV -$300 → Recommendation: "Reduce VFV by 25%"
├─ Revised: VFV -$180 (clamped 10%) → Recommendation: "Hold VFV; hedge only if tail risk worried"
└─ Alternative: "If planning for downside: reduce VFV by 15%"
```

---

## Testing & Validation

### Unit Tests: Magnitude Validator

```typescript
test('flags estimates exceeding 2x volatility', () => {
  const impacts = [
    { ticker: 'VFV', magnitudeScore: 0.08 }  // 8% move
  ]
  const volatilities = {
    'VFV': { monthly: 0.035, daily: 0.0016 }  // 3.5% monthly
  }

  const result = runMagnitudeValidator({ impacts, volatilities })

  expect(result.outOfBoundsFlags).toContain('VFV')
  expect(result.holdingValidations[0].outOfBounds).toBe(true)
  expect(result.holdingValidations[0].calibratedMagnitude).toBe(0.07)  // 2 × 3.5%
})
```

### Unit Tests: Assumptions Challenger

```typescript
test('finds counter-evidence and applies confidence haircut', async () => {
  const assessments = [
    {
      analystType: 'macro',
      keyAssumptions: [
        'Central banks hold rates through 2024',
        'Recession probability 40%'
      ],
      // ...
    }
  ]

  const result = await runAssumptionsChallenger(assessments)

  expect(result.challengedAssumptions.length).toBeGreaterThan(0)
  expect(result.recommendedConfidenceAdjustment).toBeLessThan(0)
  expect(result.recommendedConfidenceAdjustment).toBeGreaterThan(-0.5)
})
```

### Integration Test: Risk Team Parallel Execution

```typescript
test('runs all 3 agents in parallel', async () => {
  const start = performance.now()

  const result = await runRiskManagementTeam({
    analystAssessments: [...],
    holdingImpacts: [...],
    volatilities: {...},
    portfolio: {...}
  })

  const elapsed = performance.now() - start

  // Should take ~1.5s (longest agent), not 3s (sequential)
  expect(elapsed).toBeLessThan(2000)
  expect(result.assumptions).toBeDefined()
  expect(result.magnitudes).toBeDefined()
  expect(result.stress).toBeDefined()
})
```

---

## Fallback Volatility Data

When Yahoo Finance data unavailable, use fallback monthly volatility by asset class:

```typescript
const FALLBACK_MONTHLY_VOL: Record<string, number> = {
  equity: 0.05,           // 5% (normal equities)
  fixed_income: 0.02,     // 2% (bonds)
  commodity: 0.08,        // 8% (oil, metals)
  crypto: 0.15,           // 15% (highly volatile)
}

// Holds are classified by ticker:
// "ZAG", "XBB" → fixed_income
// "XEG" → commodity
// "BTCX.B" → crypto
// Everything else → equity
```

**Rationale:** Conservative fallback prevents under-estimation of volatility bounds

---

## Checkpoint 1.5: Post-Risk-Challenge (Soft Checkpoint)

After risk team completes, system shows:

```
Assumptions Challenged
═══════════════════════════════════
✓ Macro analyst: "rates staying high" → ECB signals cuts
✓ Fundamental analyst: "earnings down 15%" → Guidance revised
✓ Sentiment analyst: "fear elevated" → Sentiment turning positive
✓ Technical analyst: "support broken" → Key level holding

Magnitude Validation
════════════════════
✓ VFV: 8% estimated → clamped to 7% (exceeds volatility)
✓ ZAG: 3% estimated → accepted (within bounds)
⚠ XEG: 15% estimated → clamped to 13% (commodity volatility)

Stress Test Results
═══════════════════
Base case:   -$120 portfolio impact (5% VaR: -$180)
Downside:    -$280 portfolio impact (5% VaR: -$350)
Tail risk:   -$450 portfolio impact (5% VaR: -$550)

[Continue] [Override Challenge]
Auto-continues in: 60s ⏱
```

**User options:**
1. Continue → Fund manager uses risk-adjusted inputs
2. Override → "That assumption is solid; ignore challenge"
3. Let auto-continue → Proceeds after 60s

---

## Performance Characteristics

### Time Per Agent

```
Assumptions Challenger: 0.8–1.2s
  ├─ Gemini API call: 0.8–1.0s
  ├─ JSON parsing: 10–50ms
  └─ Validation: <5ms

Magnitude Validator: 0.3–0.7s
  ├─ Volatility lookup: 0.2–0.5s (Yahoo Finance or cache)
  ├─ Clamping logic: <5ms
  └─ LLM assessment (optional): 0.3–0.5s

Portfolio Stress Tester: 1.0–1.8s
  ├─ Correlation matrix build: 0.2–0.3s
  ├─ Monte Carlo 10k simulations: 0.7–1.2s
  └─ VaR computation: 50–100ms
```

### Wall-Clock Time (Parallel)
```
Sequential: 0.8 + 0.5 + 1.5 = 2.8s
Parallel: max(0.8, 0.5, 1.5) = 1.5s

Savings: ~1.3s (47% improvement)
```

---

## Future Enhancements

### 1. Correlation-Adaptive Volatility Bounds
Current: Fixed 2x multiplier for all assets
Future: Adaptive based on correlation regime

```
Base regime (correlation 0.3): 2.0x bound
Elevated regime (correlation 0.6): 1.8x bound  (tighter)
Crisis regime (correlation 0.9): 1.5x bound  (much tighter)
```

### 2. Assumption Revisit on New Signals
Current: Challenges static given analyst assumptions
Future: Re-challenge if new signals arrive that counter assumptions

```
Signal 1 finds: "Oil down 15%"
Risk team challenges: "OPEC signals cuts; oil less likely to drop"

Signal 2 (next day) finds: "OPEC cuts extended"
System: "Original challenge now less valid; re-assess"
```

### 3. Risk Sentiment Analysis
Current: Validator flags out-of-bounds; no context
Future: Explain why estimate is unrealistic given signal type

```
Current: "8% move exceeds 2x volatility bound"
Future: "8% move exceeds 2x volatility for rate signals.
         Rate signals typically drive 3-5% moves in this ETF.
         8% would require correlated risk factor impact."
```

### 4. Parametric Risk Measures
Current: VaR/CVaR via Monte Carlo
Future: Also compute Expected Shortfall, Conditional VaR by holding

---

## References

### Related Documentation
- [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md) — How risk team fits in full pipeline
- [Computation-First Dollar Impacts](./COMPUTATION-FIRST-DOLLAR-IMPACTS.md) — Dollar calibration that risk team protects
- [Human-In-The-Loop Checkpoints](./HUMAN-IN-THE-LOOP-CHECKPOINTS.md) — Checkpoint 1.5 (soft) after risk team

### Academic References
- **Monte Carlo VaR:** Jorion (1997) "Value at Risk"
- **Assumption Challenge:** Kahneman & Tversky on cognitive biases
- **Correlation regimes:** Ang & Bekaert (2002) on market regimes

---

**Last Updated:** 2026-03-01
**Status:** Production Ready (Phase 10)
