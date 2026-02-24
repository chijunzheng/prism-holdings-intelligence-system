# Feature: Exposure Analyzer Agent

**ID:** 03
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 02

## Description

Build the Exposure Analyzer agent — a pure data pipeline (no LLM) that decomposes the user's portfolio holdings into true asset-level exposure by looking through ETF/fund wrappers. It detects hidden concentration risk, identifies overlapping holdings, and produces the weighted ExposureMap that every downstream agent consumes.

## Why This Matters

This is the engine behind the "aha moment" — showing users their true 43% Canadian financials concentration that's hidden across 4 ETFs. It's also the foundation for all downstream intelligence: the Causal Propagation Engine needs the ExposureMap to map events to the user's actual holdings. Without accurate decomposition, nothing else works.

## Acceptance Criteria

- [ ] Decomposes each ETF/fund into underlying constituent assets using fund composition data (FR-1.2)
- [ ] Calculates dollar-weighted exposure to each underlying asset across ALL holdings (FR-1.3)
- [ ] Aggregates exposures by sector, geography, asset class (FR-1.4)
- [ ] Detects concentration risk when sector/geography/asset exceeds configurable thresholds (FR-1.5)
- [ ] Detects overlap — flags when same asset appears in multiple holdings with combined percentage (FR-1.6)
- [ ] Generates exposure delta: true exposure vs. naive reading of holdings (FR-1.7)
- [ ] Tracks data freshness per fund and flags stale decompositions
- [ ] Cross-account aggregation: TFSA + RRSP + non-registered treated as single portfolio
- [ ] Primary demo portfolio output: ~43% Canadian financials concentration
- [ ] Output is a typed, immutable ExposureMap object

## Implementation Details

### Files to Create/Modify

- `agents/exposure-analyzer/index.ts` — Agent entry point (Google ADK agent)
- `agents/exposure-analyzer/decompose.ts` — Core decomposition logic
- `agents/exposure-analyzer/concentration.ts` — Concentration detection
- `agents/exposure-analyzer/overlap.ts` — Overlap detection
- `agents/exposure-analyzer/aggregate.ts` — Sector/geography/asset class aggregation
- `shared/types/exposure.ts` — May need refinement from Feature 01
- `agents/exposure-analyzer/__tests__/` — Test files

### Key Algorithm: Decomposition

```
For each holding in portfolio:
  If holding is individual stock:
    Add to exposure map directly
  If holding is ETF/fund:
    Look up fund composition data
    For each constituent in fund:
      weight = holding_value * constituent_percentage
      Add weighted exposure to map, keyed by underlying asset
    Track data freshness of fund composition

Aggregate by:
  - Individual asset (e.g., "Royal Bank of Canada" total across all holdings)
  - Sector (e.g., "Canadian Financials" = sum of all bank/insurance/fintech exposures)
  - Geography (e.g., "Canada" vs "US" vs "International")
```

### Concentration Detection Thresholds

| Dimension | Warning | Critical |
|-----------|---------|----------|
| Single asset | > 10% | > 20% |
| Sector | > 30% | > 45% |
| Geography | > 50% | > 70% |

These should be configurable via `shared/constants/thresholds.ts`.

### Technical Decisions

- **No LLM** — this is pure math. Decomposition is deterministic given the fund composition data.
- **Immutable output** — ExposureMap is readonly; downstream agents receive a snapshot, not a mutable reference
- **Cross-account first** — always aggregate across all accounts before calculating concentrations. Per-account breakdowns are secondary.

## Dependencies

### Depends On
- **Feature 02:** Sample portfolio data + fund composition data

### Blocks
- **Feature 04:** Portfolio View X-Ray needs the ExposureMap to render
- **Feature 07:** Causal Propagation Engine needs ExposureMap to map events to holdings

## Testing Requirements

- [ ] Unit tests: Decomposition of a single ETF produces correct weighted assets
- [ ] Unit tests: Cross-holding aggregation correctly sums overlapping assets
- [ ] Unit tests: Concentration detection fires at correct thresholds
- [ ] Unit tests: Overlap detection finds Apple in VFV + XQQ
- [ ] Unit tests: Data freshness tracking flags stale funds
- [ ] Integration test: Full demo portfolio produces ~43% Canadian financials
- [ ] Edge case: Fund with missing composition data handled gracefully

## Implementation Checklist

- [ ] Implement fund decomposition logic
- [ ] Implement cross-holding aggregation
- [ ] Implement sector/geography/asset class grouping
- [ ] Implement concentration detection with configurable thresholds
- [ ] Implement overlap detection
- [ ] Implement data freshness tracking
- [ ] Wire into Google ADK as an agent
- [ ] Write comprehensive unit tests (TDD)
- [ ] Verify demo portfolio produces target concentration
- [ ] Document the decomposition algorithm

## Notes

- The decomposition is only as good as the fund composition data. If XIC's data says 35% financials but reality is 33%, the concentration number shifts. Document assumptions.
- Consider rounding: many small exposures (< 0.1%) should be grouped into "Other" for UI readability.
- The ExposureMap should include both the raw numbers AND pre-computed summaries (top concentrations, top overlaps) so the frontend doesn't have to recalculate.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
