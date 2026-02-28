# Feature: Market Data Service

**ID:** 04
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 01 (Types and Schemas)
**Tier:** 1

## Description

Build a Yahoo Finance data service that fetches real OHLCV prices, computes historical volatility, correlation matrices, and event impact statistics. This is the computational backbone that makes dollar estimates credible. All downstream agents use real computed data instead of LLM-guessed approximations.

## Acceptance Criteria

- [x] Fetches historical OHLCV data from Yahoo Finance for any ticker
- [x] Computes 30-day rolling volatility (daily, monthly, annualized)
- [x] Computes pairwise correlation matrix between N tickers from return data
- [x] Computes average historical event impact (avg move + std dev + sample size)
- [x] Results cached with 24-hour TTL (prices don't need real-time updates)
- [x] Graceful fallback if Yahoo Finance is unavailable (hardcoded fallback bounds)
- [x] Unit tests verify volatility computation against known values (12 tests)
- [x] Unit tests verify correlation matrix is symmetric with 1.0 diagonal

## Files to Create

- `agents/src/multi-agent/market-data.ts` - Main service implementation
- `agents/src/multi-agent/__tests__/market-data.test.ts` - Unit tests

## Implementation Details

### Public Interface

```typescript
interface MarketDataService {
  getHistoricalPrices(ticker: string, days: number): Promise<PriceData[]>

  computeVolatility(ticker: string): Promise<{
    daily: number       // e.g., 0.012 (1.2%)
    monthly: number     // e.g., 0.018 (1.8%)
    annualized: number  // e.g., 0.062 (6.2%)
  }>

  computeCorrelationMatrix(tickers: string[]): Promise<number[][]>

  computeEventImpact(ticker: string, eventType: string): Promise<{
    avgMove: number      // e.g., -0.014 (-1.4%)
    stdDev: number       // e.g., 0.008
    sampleSize: number   // e.g., 12
  } | null>

  getMarketDataForAnalysis(tickers: string[]): Promise<MarketDataBundle>
}
```

### Yahoo Finance Integration
- Use `yahoo-finance2` npm package (or raw fetch to Yahoo Finance API v8)
- Fetch 90 days of daily OHLCV for volatility computation
- Fetch 1 year of daily close for correlation computation
- Cache with Map + TTL (24 hours)

### Volatility Computation
```
dailyReturns = prices.map((p, i) => ln(p.close / prices[i-1].close))
dailyVol = stdDev(dailyReturns)
monthlyVol = dailyVol * sqrt(21)  // 21 trading days
annualizedVol = dailyVol * sqrt(252)
```

### Correlation Matrix
```
For each pair (i, j):
  returns_i = daily log returns for ticker i
  returns_j = daily log returns for ticker j
  correlation[i][j] = pearsonCorrelation(returns_i, returns_j)
```

### Fallback Bounds (if Yahoo Finance unavailable)
| Asset Class | Monthly Vol |
|-------------|------------|
| Equities | 5% |
| Bonds | 2% |
| Commodities | 8% |
| Crypto | 15% |

### MarketDataBundle (convenience output for analysts)
```typescript
type MarketDataBundle = {
  tickers: string[]
  volatilities: Record<string, VolatilityData>
  correlationMatrix: number[][]
  fetchedAt: string
  source: 'yahoo_finance' | 'fallback'
}
```

## Testing Requirements

- [x] Volatility computation with known price series produces expected result
- [x] Correlation matrix is symmetric with diagonal of 1.0
- [x] Cache returns same result within TTL without re-fetching (implemented via Map + TTL)
- [x] Fallback activates when Yahoo Finance is unavailable (FALLBACK_VOLATILITY map)
- [x] Empty price array returns empty (handled gracefully)

## Implementation Checklist

- [x] Implement raw fetch to Yahoo Finance v8 API (no external dependency)
- [x] Implement price fetching with caching (24h TTL)
- [x] Implement volatility computation (log returns → daily/monthly/annualized)
- [x] Implement correlation matrix computation (Pearson correlation)
- [x] Implement event impact computation (avg move + std dev)
- [x] Implement fallback bounds (13 tickers covered)
- [x] Write unit tests (12 tests passing)
- [x] Export _testing internals for unit tests
