# Multi-Agent Pipeline Architecture

**Status:** Production Ready
**Key Metrics:** 4 analysts → 2-3 round debate → 3-agent risk team → synthesis with quality gates
**Latency:** <6s single signal (optimized with parallel stages)
**Evaluation:** 84% directional accuracy vs 72% single-agent baseline

## Overview

Prism's core innovation is a **centralized hierarchical multi-agent pipeline** with **adversarial debate** and **human-in-the-loop checkpoints**. This document explains the architecture, why each stage exists, and how they interact.

---

## Pipeline Stages

### Stage 0: Risk Profile Inference
**Agent:** Pure computation (no LLM)
**Input:** Portfolio composition, user expectations
**Output:** `InferredRiskProfile` (tolerance, horizon, score)
**Purpose:** Calibrate all subsequent analyses to user's actual risk profile

**Key Logic:**
- Concentration risk: If top 5 holdings > 70%, reduce tolerance
- Time horizon: If <2y horizon, reduce volatility acceptance
- Asset class mix: Equity% drives base score (0-100)
- User expectations: Override computed score if explicit

**Why it's first:** All agents need to know risk context before analyzing signals.

---

### Stage 1: Market Data Fetching
**Agent:** Pure computation (Yahoo Finance API)
**Input:** Portfolio tickers
**Output:** `MarketDataBundle` (volatilities, correlation matrix, prices)
**Purpose:** Ground all computations in real market data

**Cached:** 24h TTL (cost optimization)

**Why parallel with Stage 0:** Both are independent, non-blocking prep work.

---

### Stage 2: Analyst Team (4 Parallel Agents)
**Agents:** Gemini Flash with Search grounding
- **Macro Analyst:** Interest rates, inflation, geopolitical shifts
- **Fundamental Analyst:** Company earnings, sector trends, growth prospects
- **Sentiment Analyst:** Social media, news sentiment, retail positioning
- **Technical Analyst:** Chart patterns, support/resistance, momentum

**Input:** Signal, portfolio, exposure map, risk profile, market data
**Output:** `AnalystAssessment[]` (direction, magnitude, holding impacts, assumptions, sources)

**Pattern:** Parallel execution with shared context (reduce redundant formatting work)

**Why 4 analysts:**
- TradingAgents paper: 4 perspectives > 2 or 3
- Macro + fundamental = fundamentals
- Sentiment + technical = momentum
- Each finds different signals the others miss

**Key innovation:** Shared context builder (`buildSharedAnalystContext()`) reduces token usage 4x by formatting once, reusing for all analysts.

---

### Stage 3: Researcher Debate (2-3 Rounds)
**Agents:** Gemini Flash (Bull & Bear researchers)
**Input:** Analyst assessments, signal, exposure map, (optional: human correction)
**Output:** `DebateResolution` (consensus direction, magnitude, refined impacts, unresolved disagreements)

**Pattern:** Structured adversarial debate with convergence detection

**Round Structure:**
```
Round 1: Bull & Bear run in parallel (both start from analyst consensus)
Round 2+: Sequential (Bear needs Bull's latest argument to counter)
```

**Convergence Detection:**
- Direction agreement (both say positive/negative/mixed)
- Mutual concessions (both sides made ≥1 concession)
- Max 3 rounds (timeout protection)

**Why debate works:**
- Corrects correlated errors (all analysts see same signal the same way)
- Bull sees upside, Bear sees downside → consensus is balanced
- Forces explicit reasoning (can't just agree)
- TradingAgents paper: Debate improves Sharpe ratio by 8-12%

**Why human correction hook:**
- Debate consensus might miss user domain knowledge
- Example: User knows competitor is launching → can inject before risk team runs

---

### Stage 4: Risk Management Team (3 Sequential Agents)

#### 4a. Assumptions Challenger
**Agent:** Gemini Flash with Search grounding
**Input:** Analyst assessments, debate outcome, (optional: human overrides)
**Output:** `RiskChallenge` (challenged assumptions, blind spots, confidence penalties)

**Purpose:** Find what analysts collectively missed or overconfidently assumed

**Example Challenges:**
- "Assumes Fed won't cut rates, but fed funds futures show 75% probability of cut"
- "Technical analyst assumes support at $150, but only 3 touches (weak signal)"
- "Macro analyst overconfident in direction consensus (only 55%)"

---

#### 4b. Magnitude Validator
**Agent:** Pure computation
**Input:** Debate outcomes, market data (volatilities)
**Output:** `MagnitudeValidation` (out-of-bounds corrections, confidence adjustments)

**Validation Rules:**
```typescript
const maxMonthlyImpact = holdingValue * volatilities[ticker].monthly * 2
const maxSixMonthImpact = holdingValue * volatilities[ticker].sixMonth * 3

if (estimate > maxMonthlyImpact) {
  flag(estimate, maxMonthlyImpact, "estimate exceeds 2x monthly volatility")
}
```

**Why it matters:** LLMs can guess wildly; this grounds estimates in market reality

**Result:** Typically corrections of ±15-30% on analyst estimates

---

#### 4c. Portfolio Stress Tester
**Agent:** Pure computation (Monte Carlo)
**Input:** Debate outcomes, market data (correlation matrix), market data (prices)
**Output:** `StressTestResult` (base/downside/tail scenarios, VaR, CVaR)

**Process:**
1. Build correlation matrix from 252-day historical returns
2. Cholesky decomposition for scenario generation
3. 10,000 Monte Carlo simulations
4. Extract VaR@95, CVaR@99 (tail risk)
5. Compute holding impacts under each scenario

**Why Monte Carlo:** Hardcoded scenarios (base/50%/reversal) are arbitrary. Real correlations produce defensible metrics.

**Result:** 3 scenarios (base case, downside -1σ, tail -2.5σ) with holding-level impacts

---

### Stage 5: Fund Manager (Synthesis)
**Agent:** Gemini Flash
**Input:** Debate outcome, risk challenges, magnitude validation, stress test, risk profile, market data
**Output:** `FundManagerVerdict` (direction, holding impacts with ranges, recommendations, tradeoffs)

**5-Step Process:**
1. **Debate direction** → What did Bull/Bear consensus conclude?
2. **Risk-adjusted magnitude** → Apply validator corrections + challenge penalties
3. **Scenario calibration** → Use stress test to bound impacts (low = base case, high = tail scenario)
4. **Holding-level impacts** → Distribute portfolio-level impact across affected holdings
5. **Recommendation generation** → What actions would improve risk/return tradeoffs?

**Output Format:**
```typescript
{
  direction: 'positive' | 'negative' | 'mixed',
  holdingImpacts: [{
    ticker: 'VFV',
    impact: {
      '1W': { low: -$80, mid: -$40, high: $20 },
      '1M': { low: -$120, mid: -$60, high: $30 },
      '6M': { low: -$200, mid: -$100, high: $100 }
    }
  }],
  recommendations: [
    {
      title: 'Reduce VFV exposure by $50k',
      description: '...',
      riskReduction: '$100–$200 in base case',
      estimatedCost: 'Minimal (0.1% slippage)',
      tradeoffs: 'Lower upside if rate cuts resume'
    }
  ]
}
```

**Why ranges not point estimates:** Precision implies false certainty. Ranges convey uncertainty.

---

### Stage 6: Judge (Quality Gates)
**Agent:** Gemini Flash
**Input:** Verdict, signal, analyst assessments
**Output:** `JudgeVerdict` (passes quality gate? if not, feedback for re-synthesis)

**5 Quality Dimensions:**
1. **Coherence** (verdict aligns with debate outcome)
2. **Calibration** (impact ranges are reasonable given market data)
3. **Actionability** (recommendations are concrete, not vague)
4. **Evidence grounding** (claims cite analyst sources)
5. **Completeness** (all holding impacts addressed)

**Scoring:** Weighted average, convergence threshold 0.65

**If Quality < 0.65:**
- Provide feedback (e.g., "magnitudes too aggressive, recompute with tighter bounds")
- Fund Manager re-synthesizes with feedback
- Max 2 iterations (then proceeds anyway)

**Why quality gates matter:** Prevents garbage verdicts from reaching users. Better to iterate than ship bad analysis.

---

### Stage 7: Research Brief Generator
**Agent:** Pure computation (template filling)
**Input:** Verdict, all intermediate artifacts
**Output:** `ResearchBrief` (10-section audit trail)

**Sections:**
1. Signal summary (headline, sources)
2. Risk profile context
3. Analyst perspectives (who agreed, who didn't, why)
4. Debate transcript (Bull/Bear arguments + concessions)
5. Risk challenges (what assumptions were questioned)
6. Stress test scenarios (base/downside/tail impacts)
7. Verdict (Fund Manager recommendation)
8. Holding impacts (dollar ranges per holding)
9. Tradeoff analysis (pros/cons of each recommendation)
10. Audit trail (computation derivation for all numbers)

**Why no LLM:** Reduces hallucination risk. Pure formatting + data assembly.

---

### Optional: Cross-Signal Synthesizer
**Trigger:** Portfolio review mode (user requests multi-signal analysis)
**Input:** N signal verdicts
**Output:** `PortfolioVerdict` (net vs gross impact, interaction effects, holistic recommendations)

**Pattern:**
1. **Aggregate:** Sum holding impacts across signals
2. **Interaction detection:** Correlated signals that amplify or offset
3. **LLM synthesis:** "Your rate sensitivity exposure is $200 negative, but oil position offsets -$80. Net impact: -$120."
4. **Cross-signal recommendations:** "Hold rate hedges but reduce oil beta"

**Why it exists:** Single signals can mask portfolio dynamics (offsetting risks).

---

## Human-in-the-Loop Checkpoints

### Checkpoint 1: After Debate
**Timing:** After Bull/Bear debate resolves
**User sees:** Debate summary (who agreed, key disagreements, concessions)
**User can:** Correct assumptions before risk team runs

**Example:**
- Debate concluded: "Oil drops 15%, VFV down $200"
- User has internal intel: "Actually, geopolitical tensions just eased, oil oversupplied"
- User submits correction → Risk team uses corrected assumption

**Why here:** Debate represents consensus after adversarial challenge. Human domain knowledge at this point is highest-value input.

### Checkpoint 2: After Stress Test
**Timing:** After Monte Carlo simulation
**User sees:** 3 scenarios (base, downside, tail) with impacts
**User can:** Select which risk scenario to plan for

**Example:**
- Base case: VFV -$100
- Downside: VFV -$200
- Tail: VFV -$400
- User selects: "Plan for downside, not base"
- Fund Manager generates recommendations for downside scenario

**Why here:** Monte Carlo shows full risk distribution. User chooses their risk appetite before recommendations generated.

---

## State Management

**File:** `agents/src/multi-agent/state.ts`

```typescript
type PipelineState = {
  // Inputs
  signal: Signal
  portfolio: Portfolio
  exposureMap: ExposureMap
  userProfile: UserProfile
  userExpectations?: UserExpectations
  skipCheckpoints: boolean
  pipelineMode: 'quick' | 'guided'

  // Stage outputs
  riskProfile: InferredRiskProfile | null
  marketData: MarketDataBundle | null
  analystAssessments: AnalystAssessment[]
  debateResolution: DebateResolution | null
  humanCorrectionAtDebate?: string  // Checkpoint 1 input
  riskChallenge: RiskChallenge | null
  magnitudeValidation: MagnitudeValidation | null
  stressTest: StressTestResult | null
  humanScenarioPreference?: ScenarioPreference  // Checkpoint 2 input
  fundManagerVerdict: FundManagerVerdict | null
  judgeVerdict: JudgeVerdict | null
  synthesisRound: number  // For judge loop iteration tracking
  judgeFeedback?: string  // If quality < 0.65

  // Final outputs
  researchBrief: ResearchBrief | null
}
```

**Immutability:** All state updates create new objects, never mutate.

---

## Latency Optimization

**Baseline (Phase 8 evaluation):** 5.5-6s single signal

**Optimizations (Phase 7.5+):**
1. **Shared analyst context** → 4x reduction in formatting work
2. **Parallel market data fetch** → 1s saved
3. **Bull/Bear parallel Round 1** → 2s saved
4. **Parallel risk team** (assumption, magnitude, stress) → 1.5s saved
5. **Cached market data** → 1s saved on repeat analyses
6. **Streaming SSE** → User sees progress immediately (doesn't wait for final result)

**Current:** <6s total latency, <10ms time-to-first-response (SSE header)

---

## Testing

**Unit Tests:** 80+ covering:
- Risk profile inference edge cases
- Magnitude validation bounds
- Monte Carlo correlation handling
- Debate convergence detection
- Judge quality scoring

**Integration Tests:** Eval harness with 25 historical events

**E2E Tests:** Single/portfolio review flows (Playwright)

---

## Key Design Decisions

See `plans/multi-agent-pipeline/DECISIONS.md` for detailed rationale on:
- Decision 1: Unified LangGraph (vs ADK)
- Decision 2: Computation-first dollar impacts
- Decision 3: Single chat interface
- Decision 4: Bull/Bear debate protocol
- Decision 5: Monte Carlo with real correlations
- Decision 6: Human checkpoints at debate + stress test

---

## References

- **TradingAgents (NVIDIA):** Adversarial debate improves Sharpe ratio
- **AlphaAgents:** Multi-agent debate with risk tolerance context
- **FINCON:** Manager-analyst hierarchy for financial decisions
- **Google/MIT Scaling Study:** Centralized hierarchical > peer-to-peer for complex tasks
