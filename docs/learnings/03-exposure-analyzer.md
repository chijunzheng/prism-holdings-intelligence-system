# Feature 03: Exposure Analyzer Agent — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Pure data pipeline (no LLM) with 4 focused modules: decompose → aggregate → overlap → concentration**

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| 4 pure modules | Testable, deterministic, fast (<10ms) | More files | **Chosen** |
| Single monolithic function | Fewer files | Hard to test, hard to read | Rejected |
| LLM-assisted classification | Could infer sector mappings | Non-deterministic, slow, expensive for pure math | Rejected |
| Pre-computed exposure maps | Instant load | Can't handle portfolio changes | Rejected |

### Why This Approach

The PRD is explicit: Exposure Analyzer uses **no LLM — pure data**. Decomposition is deterministic given fund composition data. Breaking into 4 modules (decompose, aggregate, overlap, concentration) makes each piece independently testable and keeps files under 100 lines.

## Key Decisions

### Sector Categorization with Country Context
The most non-obvious decision was the `categorize(sector, country)` function in `aggregate.ts`. The same raw sector "Financials" needs different display labels:
- Canadian Financials (from XIC, ZEB) → exposed to BoC decisions
- US Financials (from VFV's JPMorgan, Berkshire) → exposed to Fed decisions

Without country context, all financials would be lumped together, destroying the narrative about **Canadian** financials concentration specifically.

### "Other Holdings" Bucket
When a fund's top-N holdings only cover 56% of the fund, the remaining 44% is allocated to `"{Fund Name} — Other Holdings"` with the fund's primary market as country. This prevents value from disappearing from the exposure map.

### Concentration Thresholds from Constants
Thresholds are defined in `shared/constants/thresholds.ts`, not hardcoded:
- 10% → low
- 20% → medium
- 30% → high
- 40% → critical

This matches the plan's table and allows easy tuning for the demo.

## Divergence from Plan

**Concentration percentages are lower than planned:**
- Plan projected: 38% Canadian Financials, 21% US Tech, 16% Energy
- Actual output: 17.1% Canadian Financials, 12% US Tech, 9.4% Energy

**Root cause:** We only model top-N fund holdings (~45-70% coverage). The remaining fund value goes to "Other" rather than being distributed across sectors.

**Impact:** The demo still works — concentrations are correctly ordered, overlaps are detected, and warnings fire. The percentages are just lower. For the demo narrative, we can say "17% Canadian Financials — that's 3x what you'd expect from a diversified portfolio."

**Fix for production:** Source full fund constituent data from Bloomberg/Refinitiv or directly from fund providers.

## What I Learned

1. **Immutable patterns in aggregation are verbose but safe.** Every `Map` operation creates a new Map rather than mutating — this adds lines but prevents subtle bugs where the same reference is shared.

2. **The agent function signature changed** from `analyze(portfolio)` to `analyze(portfolio, getFund)` — dependency injection of the fund lookup function makes testing much easier (can provide mock fund data).

3. **Rounding matters.** Without `Math.round(percentage * 10) / 10`, floating-point math produces values like `17.09999999999998%` in the UI.

## Files Created/Modified

- `agents/src/exposure-analyzer/decompose.ts` — 97 lines, core look-through logic
- `agents/src/exposure-analyzer/aggregate.ts` — 89 lines, sector categorization
- `agents/src/exposure-analyzer/overlap.ts` — 62 lines, cross-fund overlap detection
- `agents/src/exposure-analyzer/concentration.ts` — 52 lines, threshold-based warnings
- `agents/src/exposure-analyzer/index.ts` — 53 lines, agent entry point
- Tests: 11 tests covering decomposition, overlaps, concentrations, and edge cases
