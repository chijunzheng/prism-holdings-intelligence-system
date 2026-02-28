# Feature: Backend Data Improvements (Prices, Ranges, Resolution)

**ID:** 19
**Status:** ⬜ Not Started
**Priority:** Low
**Estimated Complexity:** High
**Dependencies:** None
**Phase:** 5 — Polish & Lifecycle
**Plan References:** B1, B2, B3

## Description

Three backend improvements for data quality:

1. **B1 — Live Price Data:** Replace ~20 hardcoded prices in `MODEL_REFERENCE_PRICES_CAD` with Yahoo Finance API + 15-min cache.

2. **B2 — Confidence Ranges:** Generate low/mid/high estimates for impacts. Show "$150–$350 reduction" instead of "$247.32."

3. **B3 — Signal Resolution Detection:** Detect when signals weaken or resolve. Auto-flag stale plans. Notify user.

## Acceptance Criteria

### B1: Live Prices
- [ ] Yahoo Finance API integration for Canadian ETF/stock prices
- [ ] 15-minute cache TTL
- [ ] Fallback to hardcoded prices on API failure
- [ ] Prices used in position suggestions and evaluation

### B2: Confidence Ranges
- [ ] Impact estimates include `low`, `mid`, `high` values
- [ ] Frontend displays ranges: "$150–$350" instead of "$247"
- [ ] Ranges generated from LLM confidence scores + variance

### B3: Signal Resolution
- [ ] Periodic signal freshness check (compare signal age)
- [ ] Signals older than 7 days flagged as "may be stale"
- [ ] Plans linked to stale signals show warning
- [ ] Optional: notification when signal weakens

## Implementation Details

### B1: Live Prices

```typescript
// agents/src/strategy-simulator/price-service.ts

const priceCache = new Map<string, { price: number; fetchedAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000  // 15 min

export async function fetchLivePrice(ticker: string): Promise<number | null> {
  const cached = priceCache.get(ticker)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.price
  }

  // Yahoo Finance API call
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.TO`
  const response = await fetch(url)
  // Parse regularMarketPrice from response
  // Cache and return
}
```

Update `resolveReferencePrice()` in strategy-simulator to try live price first, fall back to `MODEL_REFERENCE_PRICES_CAD`.

### B2: Confidence Ranges

Add to `StrategyEvaluation`:
```typescript
interface ImpactRange {
  low: number
  mid: number
  high: number
}

// Extend evaluation:
downsideReductionRange?: ImpactRange  // NEW
```

Generate from existing `confidence` scores on candidates:
```typescript
function computeRange(mid: number, confidence: number): ImpactRange {
  const spread = mid * (1 - confidence)  // Lower confidence = wider range
  return {
    low: mid - spread,
    mid,
    high: mid + spread,
  }
}
```

### B3: Signal Resolution

```typescript
// server/src/signal-freshness.ts

function assessSignalFreshness(signal: Signal): 'fresh' | 'aging' | 'stale' {
  const ageMs = Date.now() - new Date(signal.detectedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays < 3) return 'fresh'
  if (ageDays < 7) return 'aging'
  return 'stale'
}
```

Add freshness indicator to signal detail + plan warnings.

## Testing Requirements

- [ ] Unit test: Price cache returns cached value within TTL
- [ ] Unit test: Falls back to hardcoded on API failure
- [ ] Unit test: Confidence range computation correct for various confidence levels
- [ ] Unit test: Signal freshness classification based on age

## Implementation Checklist

- [ ] Create price-service.ts with Yahoo Finance integration
- [ ] Add caching with 15-min TTL
- [ ] Update resolveReferencePrice to use live prices
- [ ] Add ImpactRange type and computation
- [ ] Update evaluation to include ranges
- [ ] Update frontend to display ranges
- [ ] Add signal freshness assessment
- [ ] Add stale plan warnings
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
