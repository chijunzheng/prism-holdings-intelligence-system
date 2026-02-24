# Feature: Temporal Reasoner Agent

**ID:** 08
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 07

## Description

Build the Temporal Reasoner agent that classifies each impact in a causal chain as transient, structural, or ambiguous, generates time-bucketed impact estimates (1-week, 1-month, 6-month), surfaces competing time-horizon recommendations, and produces counterfactual analysis.

## Why This Matters

This is where Prism's multi-horizon thesis comes alive. Most tools show a single recommendation. The Temporal Reasoner explicitly surfaces tensions: "Short-term buying opportunity in REITs, but long-term structural weakness in Canadian real estate." This dual-recommendation pattern is the system's most distinctive insight — and the hardest for an LLM to produce consistently.

## Acceptance Criteria

- [x] Classifies each chain impact as transient/structural/ambiguous (FR-4.1)
- [x] Generates time-bucketed impact estimates: 1-week, 1-month, 6-month with confidence intervals (FR-4.2)
- [x] Explicitly surfaces tension when short-term and long-term recommendations conflict (FR-4.3)
- [x] Generates specific rebalancing suggestions with dollar amounts from actual holdings (FR-4.4)
- [x] Produces counterfactual analysis: "If you had rebalanced 3 months ago..." (FR-4.5)
- [x] All recommendations reference user context: age, risk tolerance, goals (FR-5.1)
- [x] Never presents single "right answer" — always options with tradeoffs
- [x] Defaults to "ambiguous" when confidence is below threshold
- [x] Output includes classification methodology reasoning

## Implementation Details

### Files to Create/Modify

- `agents/temporal-reasoner/index.ts` — Google ADK agent entry
- `agents/temporal-reasoner/classify.ts` — Temporal classification logic
- `agents/temporal-reasoner/time-buckets.ts` — Time-bucketed impact estimation
- `agents/temporal-reasoner/recommendations.ts` — Rebalancing suggestion generation
- `agents/temporal-reasoner/counterfactual.ts` — Counterfactual analysis
- `agents/temporal-reasoner/prompts.ts` — Prompt templates
- `agents/temporal-reasoner/types.ts` — Temporal analysis output types
- `agents/temporal-reasoner/__tests__/` — Test files

### Classification Prompt Strategy

The Gemini prompt provides:
1. The full causal chain (from Feature 07)
2. The user's ExposureMap with dollar amounts
3. The user's profile (age, risk tolerance, goals, account types)
4. Request for classification using the four-factor methodology:
   - Historical base rate (how often has this type of event been transient vs. structural?)
   - Signal clustering (isolated event or part of a pattern?)
   - Structural indicators (does this change fundamental economics?)
   - Contextual synthesis (LLM's overall assessment)

### Competing Recommendations Format

```typescript
interface TemporalAnalysis {
  readonly classification: 'transient' | 'structural' | 'ambiguous'
  readonly confidence: number
  readonly methodology: ClassificationMethodology
  readonly timeBuckets: {
    readonly oneWeek: ImpactEstimate
    readonly oneMonth: ImpactEstimate
    readonly sixMonth: ImpactEstimate
  }
  readonly recommendations: ReadonlyArray<Recommendation>
  readonly tension?: {
    readonly shortTermView: string
    readonly longTermView: string
    readonly explanation: string
    readonly whatEachAssumes: string
  }
  readonly counterfactual?: CounterfactualAnalysis
}
```

### Rebalancing Suggestions

Must be concrete, not generic:
- "Consider reducing ZEB (BMO Equal Weight Banks) by $1,600 (50%) in your RRSP"
- "Redirect to ZAG (bonds) or XUS (US equities) to reduce Canadian financials from 43% to ~28%"
- Include tax implications per account type: "Selling in non-registered triggers capital gains; selling in TFSA does not"

### Technical Decisions

- **User profile injected into prompt** — recommendations must be personalized, not generic
- **Tension detection is explicit** — prompt asks "Do short-term and long-term implications point in different directions? If so, describe both."
- **Counterfactual uses historical data** — "3 months ago" comparison uses pre-computed scenario, not live recalculation

## Dependencies

### Depends On
- **Feature 07:** Causal chain as input

### Blocks
- **Feature 09:** Alert Composer uses temporal analysis for alert formatting
- **Feature 10:** Causal Graph View renders temporal classifications

## Testing Requirements

- [x] Unit tests: Classification output matches expected schema
- [x] Unit tests: Time-bucketed estimates have confidence intervals
- [x] Unit tests: Competing recommendations detected and surfaced
- [x] Unit tests: Rebalancing suggestions reference actual holdings with dollar amounts
- [x] Unit tests: User profile context appears in recommendation reasoning
- [x] Unit tests: Low-confidence classifications default to "ambiguous"
- [x] Integration test: Full chain → classification → recommendations pipeline
- [x] Edge case: All impacts are same direction (no tension) → no tension field

## Implementation Checklist

- [x] Design classification prompt with four-factor methodology
- [x] Implement temporal classification
- [x] Implement time-bucketed impact estimation
- [x] Implement competing recommendation detection
- [x] Implement rebalancing suggestion generation with dollar amounts
- [x] Implement counterfactual analysis
- [x] Wire into Google ADK-style agent interface
- [x] Write unit tests (TDD)
- [x] Test with deterministic causal chain fixtures from Feature 07 structure
- [x] Verify personalization: same chain + different profiles → different recommendations

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
