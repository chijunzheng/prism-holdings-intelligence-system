# Cross-Signal Synthesis: Portfolio-Level Impact Analysis

**Status:** Production Ready (Portfolio review mode)
**Pattern:** Pure computation (aggregation) + LLM (insights/recommendations)
**Key Insight:** Net ≠ Gross when signals interact; synthesizer detects offsetting vs compounding effects

---

## Overview

When multiple signals are active simultaneously, their impacts **interact**. A rate hike may hurt financials but help bonds. Oil drop may hurt energy but help airlines. The **Cross-Signal Synthesizer** detects these interactions and generates portfolio-level analysis.

**Example:**
```
Signal 1 (Rate Hike):  RY -$200, ZAG -$100
Signal 2 (Oil Drop):   RY +$80,  ENB -$300

Synthesizer Output:
├─ RY: offsetting (rate hike/oil drop in opposite directions on same holding)
├─ ZAG: independent (only affected by rate hike)
├─ ENB: independent (only affected by oil drop)
├─ Net impact: -$520
├─ Gross impact: -$600
└─ Interaction savings: $80 (signals partially offset each other)
```

---

## Why Portfolio-Level Synthesis Matters

### Without Cross-Signal Analysis
User sees two recommendations in isolation:
- "Rate hike impact: -$300 net exposure"
- "Oil drop impact: -$400 net exposure"
- Total shown: -$700

User thinks: "I could lose $700 in this portfolio."

### With Cross-Signal Synthesis
System shows:
- Gross impact (signals treated independently): -$600
- Net impact (accounting for interactions): -$480
- Interaction effect: +$120 savings from offsetting signals
- Holistic recommendation: "Two signals pull portfolio in different directions. Rate hike exposure is partially offset by oil impact on energy stocks."

User thinks: "My holdings balance each other out somewhat. Net risk is -$480, not -$600."

---

## Two-Phase Architecture

### Phase 1: Pure Computation (Deterministic)

**Input:** N FundManagerVerdicts (one per signal)

**Process:**
1. **Aggregate per-holding impacts** — group signal contributions by holding ticker
2. **Classify interactions** — for each holding, determine if signals offset or compound
3. **Compute net vs gross** — apply interaction logic to calculate true portfolio impact
4. **Uncertainty propagation** — widen/narrow confidence ranges based on interaction type

**Output:** `HoldingNetImpact[]` + portfolio-level `DollarRange` for net and gross

This phase is 100% deterministic and testable. No LLM involved.

### Phase 2: LLM Insights & Recommendations (Qualitative)

**Input:** HoldingNetImpact[] + signal verdicts

**Process:**
1. **Generate interaction insights** — LLM explains why signals offset or compound
2. **Generate holistic recommendations** — LLM creates portfolio-level recommendations that account for all signals + interactions

**Output:** `PortfolioVerdict` with interaction insights + recommendations

---

## Interaction Classification

### Three Interaction Types

#### 1. Independent
**When:** A holding is affected by only one signal
**Logic:** Impact = signal's impact (no modification)
**Uncertainty:** Standard ±range from signal's calibration

**Example:**
```
ZAG (bond ETF): only affected by rate hike → independent
ENB (energy): only affected by oil drop → independent
```

#### 2. Offsetting
**When:** Multiple signals affect the same holding with opposite directions
**Logic:** Range narrows (impacts partially cancel each other)
**Example:**
```
RY (bank): rate hike -$200, oil drop +$80
Direction: negative + positive → offsetting

Net: -$200 + $80 = -$120
Gross: |-$200| + |$80| = $280
Savings: $280 - $120 = $160 (40% reduction from cancellation)
```

#### 3. Compounding
**When:** Multiple signals affect the same holding with same direction
**Logic:** Range widens (combined exposure is worse than either alone)
**Example:**
```
ZAG (bonds): rate hike -$100, credit event -$150
Direction: negative + negative → compounding

Net: -$100 + -$150 = -$250
Worst case: could exceed either signal alone if events interact
Range: widened by uncertainty spread (25% margin)
```

---

## Computation Details

### Step 1: Aggregate Per-Holding Impacts

```typescript
// Input: 2 signals, each with impacts on multiple holdings
signalVerdicts = [
  {
    signal: "Rate Hike",
    verdict: {
      holdingImpacts: [
        { ticker: "RY", impact: { 1M: { low: -250, mid: -200, high: -150 } } },
        { ticker: "ZAG", impact: { 1M: { low: -80, mid: -100, high: -120 } } }
      ]
    }
  },
  {
    signal: "Oil Drop",
    verdict: {
      holdingImpacts: [
        { ticker: "RY", impact: { 1M: { low: 60, mid: 80, high: 100 } } },
        { ticker: "ENB", impact: { 1M: { low: -350, mid: -300, high: -250 } } }
      ]
    }
  }
]

// Process: Group by ticker
holdings = {
  "RY": [{ signalId: "rate_hike", impact: { low: -250, mid: -200, high: -150 } },
         { signalId: "oil_drop", impact: { low: 60, mid: 80, high: 100 } }],
  "ZAG": [{ signalId: "rate_hike", impact: { low: -80, mid: -100, high: -120 } }],
  "ENB": [{ signalId: "oil_drop", impact: { low: -350, mid: -300, high: -250 } }]
}

// Output: HoldingNetImpact[] with interaction classification for each holding
```

### Step 2: Classify Interaction (Per Holding)

```typescript
function classifyInteraction(contributions: SignalContribution[]): InteractionType {
  if (contributions.length <= 1) return 'independent'

  // Check signal directions
  const directions = contributions.map(c => Math.sign(c.impact.mid))
  const hasPositive = directions.some(d => d > 0)
  const hasNegative = directions.some(d => d < 0)

  // Mixed directions = offsetting; same direction = compounding
  return (hasPositive && hasNegative) ? 'offsetting' : 'compounding'
}

// Example:
classifyInteraction([
  { signalId: "rate_hike", impact: { mid: -200 } },
  { signalId: "oil_drop", impact: { mid: 80 } }
])
// Returns: 'offsetting' (negative + positive)
```

### Step 3: Compute Net vs Gross

#### For Offsetting Interactions

```typescript
// Offsetting: impacts partially cancel, so range narrows
function computeNetImpact(contributions, 'offsetting'): DollarRange {
  const lowSum = -250 + 60 = -190
  const midSum = -200 + 80 = -120
  const highSum = -150 + 100 = -50

  // When signals offset, worst case is not (worst + worst)
  // Instead, worst case is the maximum downside direction
  return {
    low: Math.min(lowSum, highSum) = -190,  // Most negative
    mid: midSum = -120,
    high: Math.max(lowSum, highSum) = -50   // Least negative
  }
  // Result: -$190 to -$50, midpoint -$120
  // Compared to gross |-200| + |80| = $280
  // Net is 57% of gross due to offsetting
}
```

#### For Compounding Interactions

```typescript
// Compounding: impacts reinforce, so range widens
function computeNetImpact(contributions, 'compounding'): DollarRange {
  const lowSum = -80 + -150 = -230
  const midSum = -100 + -150 = -250
  const highSum = -120 + -200 = -320

  // When signals compound, worst case can exceed simple sum
  // Add 25% margin for interaction effects
  const spread = Math.abs(highSum - lowSum) * 0.25 = 22.5

  return {
    low: Math.min(lowSum, highSum) - spread = -320 - 22.5 = -342.5,
    mid: midSum = -250,
    high: Math.max(lowSum, highSum) + spread = -230 + 22.5 = -207.5
  }
  // Result: -$342.5 to -$207.5, midpoint -$250
  // Worse than either signal alone: shows amplified risk
}
```

### Step 4: Portfolio-Level Aggregation

```typescript
function computePortfolioImpact(holdingNetImpacts): { net, gross } {
  // Sum all net impacts
  const net = {
    low: -190 + -80 + -350 = -620,
    mid: -120 + -100 + -300 = -520,
    high: -50 + -120 + -250 = -420
  }

  // Sum all gross impacts
  const gross = {
    low: 250 + 80 + 350 = 680,
    mid: 200 + 100 + 300 = 600,
    high: 150 + 100 + 250 = 500
  }

  return { net, gross }
}

// Portfolio-level insight:
// Gross (signals independent): -$600
// Net (with interactions): -$520
// Interaction savings: $80 (RY offsetting reduced portfolio downside by 13%)
```

---

## LLM Phase: Interaction Insights

### What Insights Provide

After pure computation, LLM explains interaction effects in plain English:

```
"The oil price drop partially offsets the rate hike impact on Royal Bank.
The rate hike pressures bank valuations (-$200), but lower oil costs boost
their customer base. Net RY exposure reduced by ~$80.

However, your energy holdings (ENB) face double pressure: oil drop (-$300)
plus potential credit tightening from higher rates. These signals compound."
```

### Prompt Structure

```
Input:
- Active signals list
- Per-holding breakdown with interaction classifications
- Net vs gross impact with dollar amounts

LLM Task:
1. Explain why specific holdings experience offsetting signals
2. Explain why other holdings face compounding risk
3. Quantify the interaction effect (savings from offsetting, widening from compounding)
4. Write for retail investor (avoid jargon)

Output: Array of 2-4 insights (strings)
```

### Example LLM Output

```typescript
generateInteractionInsights() returns [
  "The oil price drop partially offsets the rate hike impact on Royal Bank.
   Rate hike pressures bank valuations (-$200), but lower oil costs should
   boost bank lending to energy companies. Net RY exposure reduced by ~$80.",

  "Your energy holdings (ENB) face compounding pressure. Oil drop (-$300)
   combines with potential credit tightening from higher rates. These signals
   reinforce each other, widening the downside range to -$350 worst-case."
]
```

---

## LLM Phase: Holistic Recommendations

### Multi-Signal Recommendation Strategy

Instead of per-signal recommendations (which ignore interactions), generate portfolio-level recommendations that:

1. **Account for all active signals** — don't hedge one signal if it increases another's risk
2. **Highlight offsetting opportunities** — "do nothing" might be optimal if signals balance
3. **Flag compounding risks** — "if you act, reduce compounding holdings first"
4. **Show cumulative cost** — "inaction costs you $520 across all signals, not individually"

### Prompt Structure

```
Input:
- All per-signal recommendations
- Holding-level net impacts
- Portfolio gross vs net
- Offsetting + compounding classification

LLM Task:
1. Generate 2-4 portfolio-level recommendations
2. First MUST be "do nothing" baseline showing cumulative cost
3. Each should have: id, title, description, estimatedCost, riskReduction, tradeoffs, isDoNothing
4. Flag if hedging one signal increases another's risk
5. Prioritize offsetting interactions (they reduce portfolio pressure)

Output: Recommendation[] (JSON array)
```

### Example LLM Output

```typescript
generateHolisticRecommendations() returns [
  {
    id: "holistic-do-nothing",
    title: "Do nothing",
    description: "Accept cumulative net exposure of ~$520 across rate and oil signals.",
    estimatedCost: "$0",
    riskReduction: "None",
    tradeoffs: ["Full exposure to all signals"],
    isDoNothing: true
  },
  {
    id: "holistic-hedge-compounding",
    title: "Reduce energy exposure",
    description: "Energy holdings face compounding risk from oil + rate signals.
                  Reduce ENB by $150 to limit downside. Don't reduce RY (it's offsetting).",
    estimatedCost: "$50",
    riskReduction: "Reduces energy compounding risk by ~$200",
    tradeoffs: ["Transaction costs", "Miss upside if oil stabilizes"],
    isDoNothing: false
  }
]
```

---

## Data Model: PortfolioVerdict

```typescript
interface PortfolioVerdict {
  // Per-signal breakdown
  signals: Array<{
    signalId: string
    headline: string
    individualVerdict: FundManagerVerdict  // Original signal verdict
  }>

  // Holdings with interaction classification
  holdingNetImpacts: HoldingNetImpact[]

  // Portfolio-level impact
  portfolioNetImpact: DollarRange
  portfolioGrossImpact: DollarRange

  // LLM insights
  keyInsights: string[]

  // Holistic recommendations
  recommendations: Recommendation[]

  // Summary for user
  interactionSummary: string
  // Example: "3 signals affecting 5 holdings. 1 holding has offsetting signals,
  //           saving $80. Net portfolio impact: -$520 vs gross -$600."

  // Immutable: user must decide
  humanDecisionRequired: true
}
```

---

## Integration: Portfolio Review Mode

### When Synthesizer Runs

Portfolio review mode triggers when:
1. **User navigates to portfolio view** after analyzing multiple signals
2. **Multiple signals are active** (≥2 signals with verdicts ready)
3. **Same holdings affected** by multiple signals (triggers interaction analysis)

### Data Flow

```
Signal 1 → Analyst Team → Debate → Risk Team → Fund Manager → Verdict 1 ┐
Signal 2 → Analyst Team → Debate → Risk Team → Fund Manager → Verdict 2 ├→ Cross-Signal Synthesizer
Signal 3 → Analyst Team → Debate → Risk Team → Fund Manager → Verdict 3 ┘
                                                                  ↓
                                                         PortfolioVerdict
                                                              ↓
                                                    PortfolioReviewCard
```

### Frontend Integration

```typescript
// Portfolio review endpoint
POST /api/v2/portfolio-review
{
  userId: "user-123",
  signalIds: ["signal-rate", "signal-oil", "signal-credit"]
}

// Returns PortfolioReviewCard data
{
  type: 'portfolio_review',
  data: {
    interactionSummary: "3 signals, 2 offsetting on RY, 1 compounding on ZAG...",
    portfolioNet: { low: -620, mid: -520, high: -420 },
    portfolioGross: { low: 600, mid: 600, high: 500 },
    holdingCards: [
      { ticker: "RY", name: "Royal Bank", interaction: "offsetting", ... },
      { ticker: "ZAG", name: "BMO Bond", interaction: "compounding", ... }
    ],
    keyInsights: ["Oil drop offsets rate hike on banks...", ...],
    recommendations: [{ title: "Do nothing", ... }, { title: "Reduce energy...", ... }]
  }
}
```

---

## Testing Strategy

### Unit Tests: Pure Computation

All interaction classification and net/gross calculation is tested with deterministic examples:

```typescript
// Test: Offsetting reduces effective impact
const contributions = [
  { signalId: "rate", impact: { low: -250, mid: -200, high: -150 } },
  { signalId: "oil", impact: { low: 60, mid: 80, high: 100 } }
]
const result = computeNetImpact(contributions, 'offsetting')
expect(Math.abs(result.mid)).toBeLessThan(200) // net < individual signal
```

```typescript
// Test: Compounding widens uncertainty
const contributions = [
  { signalId: "rate", impact: { low: -80, mid: -100, high: -120 } },
  { signalId: "credit", impact: { low: -150, mid: -150, high: -150 } }
]
const result = computeNetImpact(contributions, 'compounding')
expect(Math.abs(result.high)).toBeGreaterThan(
  Math.abs(-100) + Math.abs(-150) // worst case exceeds simple sum
)
```

### Integration Tests: End-to-End Portfolio Review

```typescript
// Test: Full synthesizer with real verdicts
const verdicts = [
  { signal: rateHikeSignal, verdict: rateHikeVerdict },
  { signal: oilDropSignal, verdict: oilDropVerdict }
]
const portfolio = await synthesizeCrossSignal({ signalVerdicts: verdicts })

expect(portfolio.portfolioNetImpact.mid).toBeLessThan(
  Math.abs(rateHikeVerdict.netImpact.mid) + Math.abs(oilDropVerdict.netImpact.mid)
) // Net < gross (offsetting detected)
```

---

## Future Enhancements

### 1. Time-Horizon Interaction
Current: Uses preferred horizon (1M > 1W > 6M)
Future: Analyze how interactions differ across time horizons
```
Example: Rate hike negative short-term, positive long-term →
         changes interaction classification at 6M horizon
```

### 2. Correlation-Based Uncertainty
Current: Uses fixed ±25% spread for compounding
Future: Derive spread from historical correlation between signal types
```
Example: Rate+oil correlations historically ~0.3 →
         compounding spread = 30% vs static 25%
```

### 3. Dynamic Recommendation Ordering
Current: LLM generates recommendations in fixed sequence
Future: Rank recommendations by user's risk profile + preferences
```
Example: Conservative user → "reduce compounding" first
         Aggressive user → "leverage offsetting" first
```

### 4. Real-Time Interaction Monitoring
Current: Computed once when user views portfolio
Future: Continuously monitor signals and highlight when interactions change
```
Example: New signal breaks offsetting pattern → alert user immediately
```

---

## References

### Related Documentation
- [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md) — Understanding individual signal verdicts
- [Computation-First Dollar Impacts](./COMPUTATION-FIRST-DOLLAR-IMPACTS.md) — Understanding anchoring system that feeds interaction computation
- [Single Chat Interface UI](./SINGLE-CHAT-INTERFACE-UI.md) — PortfolioReviewCard component design

### Mathematical Concepts
- **Correlation & Portfolio Theory:** How signals interact (negative = offsetting, positive = compounding)
- **Uncertainty Propagation:** How to widen/narrow ranges based on interaction type
- **Interaction Effects in Finance:** Why gross ≠ net in multi-signal portfolios

---

**Last Updated:** 2026-03-01
**Status:** Production Ready (Phase 10)
