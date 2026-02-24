# Feature 09: Alert Composer & Personalization — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Deterministic personalization + alert policy engine with in-memory dispatch controls**

### Why This Approach

Feature 09 needed stable alert gating and predictable personalization behavior for downstream demo flow. A deterministic policy layer avoids LLM variability for thresholding/frequency logic and keeps results testable.

## Key Decisions

### Personalization Engine as shared service
- Added `agents/src/personalization/` with:
  - user context lookup
  - profile-specific materiality thresholds
  - urgency multipliers by profile + classification
  - tone selection from financial literacy
  - effective daily cap (`min(profile cap, global max=2)`)

### Alert gating policy
- Materiality threshold by risk profile:
  - low risk: 1%
  - moderate: 2%
  - high: 5%
- Frequency cap enforced per user/day.
- Anti-spam suppresses repeated chain alerts unless one-month magnitude changes by at least 15%.

### Tone-aware formatting
- `simple`, `moderate`, and `advanced` body templates generate profile-adapted language.
- Signal-card payload includes:
  - headline
  - classification badge
  - materiality indicator

### Integration with Temporal Reasoner
- `compose()` accepts optional precomputed `TemporalAnalysis`.
- If omitted, it computes analysis via Feature 08 before formatting.

## What I Learned

1. **Policy logic should be separated from language formatting.**
   - Materiality/frequency decisions are easier to validate when isolated from text generation.

2. **Anti-spam needs magnitude delta, not exact equality.**
   - A relative-change threshold is robust to small estimate noise while still surfacing meaningful updates.

3. **Vitest monorepo aliasing matters for shared service imports.**
   - Added `@prism/data` alias in `vitest.config.ts` so personalization context tests resolve consistently.

## Files Created/Modified

- `agents/src/alert-composer/index.ts`
- `agents/src/alert-composer/thresholds.ts`
- `agents/src/alert-composer/frequency.ts`
- `agents/src/alert-composer/format.ts`
- `agents/src/alert-composer/__tests__/alert-composer.test.ts`
- `agents/src/personalization/index.ts`
- `agents/src/personalization/context.ts`
- `agents/src/index.ts`
- `vitest.config.ts`
