# Feature 08: Temporal Reasoner Agent — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Deterministic temporal scoring pipeline with multi-horizon heuristics**

### Why This Approach

Feature 08 needed reliable structured output for downstream features (Alert Composer, Graph View). A deterministic approach avoids schema drift and preserves predictable behavior under live demos while still supporting future LLM enrichment via prompt templates.

## Key Decisions

### Context-first classification
- `classifyTemporalDynamics` derives:
  - overall temporal class (`transient` / `structural` / `ambiguous`)
  - confidence
  - per-asset impact classifications
  - competing-effects signal and direction bias
- Confidence below the configured floor defaults to `ambiguous` per requirements.

### Time buckets with confidence intervals
- Generated fixed buckets: 1-week, 1-month, 6-month.
- Confidence intervals expand for ambiguous scenarios.
- For balanced competing effects, long horizon can invert sign to surface explicit short-vs-long tension.

### Personalization in recommendation text
- Recommendations include user age, risk tolerance, and goals in rationale.
- Dollar shifts are derived from top impacted asset nodes to keep advice concrete.
- Multiple options are always returned with explicit tradeoffs (never single “right answer”).

### Counterfactual generation
- Adds a standardized “If you had rebalanced 3 months ago…” scenario with estimated CAD impact delta.

## What I Learned

1. **Tension detection needs direction divergence, not just competing edges.**
   - Competing pathways alone were insufficient.
   - Explicit one-week vs six-month sign divergence was needed for robust tension surfacing.

2. **Per-asset classifications make downstream personalization easier.**
   - Alert Composer can later target specific holdings directly using this structure.

3. **Heuristic + typed output is robust for prototype integration.**
   - Tests validate schema stability across edge cases (low confidence, one-direction chains, competing chains).

## Files Created/Modified

- `agents/src/temporal-reasoner/index.ts`
- `agents/src/temporal-reasoner/types.ts`
- `agents/src/temporal-reasoner/classify.ts`
- `agents/src/temporal-reasoner/time-buckets.ts`
- `agents/src/temporal-reasoner/recommendations.ts`
- `agents/src/temporal-reasoner/counterfactual.ts`
- `agents/src/temporal-reasoner/prompts.ts`
- `agents/src/temporal-reasoner/__tests__/temporal-reasoner.test.ts`
