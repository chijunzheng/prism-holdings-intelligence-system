# Feature: Portfolio Health Score Engine

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Create a composite portfolio health scoring system (A+ to F) that quantifies diversification quality, concentration risk, overlap exposure, and data freshness into a single trackable metric. This score powers the Intelligence Briefing (Feature 02) and Risk Radar (Feature 04).

## Acceptance Criteria

- [ ] Health score calculated from weighted formula: diversification spread, concentration count/severity, overlap %, data freshness
- [ ] Score maps to letter grade A+ through F with clear thresholds
- [ ] Score includes sub-scores for each dimension (diversification, concentration, overlap, freshness)
- [ ] Exposed via a `usePortfolioHealth` hook that consumes existing exposure data
- [ ] Pure computation — no LLM calls needed
- [ ] Returns actionable insights per sub-score (e.g., "3 concentrations above 20% threshold")

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/hooks/usePortfolioHealth.ts` — New hook computing health score from ExposureMap
- `packages/shared/src/types/health-score.ts` — Types for HealthScore, SubScore, LetterGrade
- `packages/frontend/src/utils/health-scoring.ts` — Pure scoring functions (testable)

### Scoring Formula (Suggested)

```
diversificationScore = f(number of sectors, spread evenness via Herfindahl index)
concentrationScore = f(count of warnings, max severity)
overlapScore = f(total overlap %, number of overlapping assets)
freshnessScore = f(staleFunds count, days since update)

compositeScore = 0.35 * diversification + 0.30 * concentration + 0.25 * overlap + 0.10 * freshness
letterGrade = mapToGrade(compositeScore)  // A+ = 90+, A = 85+, ... F = <40
```

### Key Components

1. **Health Score Calculator** — Pure functions taking ExposureMap → HealthScore
2. **usePortfolioHealth hook** — React hook wrapping calculator with exposure data
3. **Shared types** — HealthScore interface used by Features 02, 04, 08

## Dependencies

### Depends On
- None (uses existing ExposureMap data from `useExposureData` hook)

### Blocks
- **Feature 02:** Intelligence Briefing needs health score for narrative
- **Feature 04:** Risk Radar displays health score prominently
- **Feature 08:** Scenario Playground compares health scores before/after changes

## Testing Requirements

- [ ] Unit tests for scoring functions (each sub-score + composite)
- [ ] Edge cases: empty portfolio, single holding, all same sector
- [ ] Grade boundary tests (verify A+/A/B+/.../F thresholds)

## Notes

- The Herfindahl-Hirschman Index (HHI) is a good measure of concentration — sum of squared percentage shares. Lower = more diversified.
- Keep scoring deterministic and reproducible — no randomness or LLM involvement.
- Consider whether to weight by dollar amount or just count-based metrics.

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
