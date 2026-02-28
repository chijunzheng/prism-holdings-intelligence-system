// Market Data Service — Yahoo Finance data fetching + computation
// Provides real volatility, correlation matrix, and event impact statistics.
// Cached with 24h TTL. Falls back to hardcoded estimates if API unavailable.

import type { VolatilityData, MarketDataBundle } from '@prism/shared'

// ── Types ────────────────────────────────────────────────────
type PriceData = {
  readonly date: string
  readonly open: number
  readonly high: number
  readonly low: number
  readonly close: number
  readonly volume: number
}

type EventImpactData = {
  readonly avgMove: number
  readonly stdDev: number
  readonly sampleSize: number
}

type CacheEntry<T> = {
  readonly value: T
  readonly expiresAt: number
}

// ── Cache ────────────────────────────────────────────────────
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

const priceCache = new Map<string, CacheEntry<readonly PriceData[]>>()
const volatilityCache = new Map<string, CacheEntry<VolatilityData>>()
const correlationCache = new Map<string, CacheEntry<readonly (readonly number[])[]>>()

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value
  }
  cache.delete(key)
  return null
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
}

// ── Yahoo Finance Fetching ───────────────────────────────────
async function fetchYahooFinancePrices(
  ticker: string,
  days: number,
): Promise<readonly PriceData[]> {
  // Map Canadian tickers to Yahoo Finance format
  const yahooTicker = mapToYahooTicker(ticker)

  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - days * 24 * 60 * 60
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}` +
    `?period1=${period1}&period2=${period2}&interval=1d`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status} for ${ticker}`)
  }

  const data = (await response.json()) as {
    chart: {
      result: {
        timestamp: number[]
        indicators: {
          quote: {
            open: (number | null)[]
            high: (number | null)[]
            low: (number | null)[]
            close: (number | null)[]
            volume: (number | null)[]
          }[]
        }
      }[]
    }
  }

  const result = data.chart.result[0]
  if (!result?.timestamp) {
    throw new Error(`No price data returned for ${ticker}`)
  }

  const quotes = result.indicators.quote[0]
  const prices: PriceData[] = []

  for (let i = 0; i < result.timestamp.length; i++) {
    const close = quotes.close[i]
    const open = quotes.open[i]
    const high = quotes.high[i]
    const low = quotes.low[i]
    const volume = quotes.volume[i]

    if (close !== null && open !== null && high !== null && low !== null && volume !== null) {
      prices.push({
        date: new Date(result.timestamp[i] * 1000).toISOString().split('T')[0],
        open,
        high,
        low,
        close,
        volume,
      })
    }
  }

  return prices
}

function mapToYahooTicker(ticker: string): string {
  // Canadian ETFs traded on TSX need .TO suffix
  const canadianTickers = new Set([
    'VFV', 'XIC', 'ZAG', 'ZEB', 'XEG', 'XGD', 'XQQ', 'ZDV',
    'SHOP', 'RY', 'ENB', 'BTCX.B',
  ])

  if (canadianTickers.has(ticker)) {
    return `${ticker.replace('.', '-')}.TO`
  }
  return ticker
}

// ── Volatility Computation ───────────────────────────────────
function computeLogReturns(prices: readonly PriceData[]): readonly number[] {
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].close
    const curr = prices[i].close
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev))
    }
  }
  return returns
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function computeVolatilityFromPrices(prices: readonly PriceData[]): VolatilityData {
  const returns = computeLogReturns(prices)
  const dailyVol = standardDeviation(returns)

  return {
    daily: dailyVol,
    monthly: dailyVol * Math.sqrt(21), // 21 trading days
    annualized: dailyVol * Math.sqrt(252),
  }
}

// ── Correlation Matrix ───────────────────────────────────────
function pearsonCorrelation(x: readonly number[], y: readonly number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0

  const xSlice = x.slice(0, n)
  const ySlice = y.slice(0, n)

  const meanX = xSlice.reduce((sum, v) => sum + v, 0) / n
  const meanY = ySlice.reduce((sum, v) => sum + v, 0) / n

  let numerator = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX
    const dy = ySlice[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denom = Math.sqrt(denomX * denomY)
  if (denom === 0) return 0

  return numerator / denom
}

function computeCorrelationMatrixFromReturns(
  returnArrays: readonly (readonly number[])[],
): readonly (readonly number[])[] {
  const n = returnArrays.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1.0
      } else if (j > i) {
        const corr = pearsonCorrelation(returnArrays[i], returnArrays[j])
        matrix[i][j] = corr
        matrix[j][i] = corr
      }
    }
  }

  return matrix
}

// ── Fallback Data ────────────────────────────────────────────
const FALLBACK_VOLATILITY: Record<string, VolatilityData> = {
  VFV: { daily: 0.012, monthly: 0.025, annualized: 0.086 },
  XIC: { daily: 0.011, monthly: 0.023, annualized: 0.079 },
  ZAG: { daily: 0.004, monthly: 0.018, annualized: 0.062 },
  ZEB: { daily: 0.010, monthly: 0.021, annualized: 0.072 },
  XEG: { daily: 0.018, monthly: 0.038, annualized: 0.131 },
  XGD: { daily: 0.020, monthly: 0.042, annualized: 0.145 },
  NVDA: { daily: 0.030, monthly: 0.065, annualized: 0.224 },
  TSLA: { daily: 0.035, monthly: 0.075, annualized: 0.259 },
  'BTCX.B': { daily: 0.040, monthly: 0.085, annualized: 0.293 },
  SHOP: { daily: 0.028, monthly: 0.060, annualized: 0.207 },
  RY: { daily: 0.012, monthly: 0.025, annualized: 0.086 },
  ENB: { daily: 0.010, monthly: 0.021, annualized: 0.072 },
  ZDV: { daily: 0.009, monthly: 0.019, annualized: 0.066 },
}

// ── Public API ───────────────────────────────────────────────
export async function getHistoricalPrices(
  ticker: string,
  days: number = 90,
): Promise<readonly PriceData[]> {
  const cacheKey = `${ticker}-${days}`
  const cached = getCached(priceCache, cacheKey)
  if (cached) return cached

  try {
    const prices = await fetchYahooFinancePrices(ticker, days)
    setCache(priceCache, cacheKey, prices)
    return prices
  } catch (error) {
    console.error(`Failed to fetch prices for ${ticker}:`, error)
    return []
  }
}

export async function computeVolatility(ticker: string): Promise<VolatilityData> {
  const cached = getCached(volatilityCache, ticker)
  if (cached) return cached

  try {
    const prices = await getHistoricalPrices(ticker, 90)
    if (prices.length < 10) {
      throw new Error(`Insufficient price data for ${ticker}: ${prices.length} days`)
    }
    const vol = computeVolatilityFromPrices(prices)
    setCache(volatilityCache, ticker, vol)
    return vol
  } catch (error) {
    console.error(`Using fallback volatility for ${ticker}:`, error)
    return FALLBACK_VOLATILITY[ticker] ?? { daily: 0.015, monthly: 0.032, annualized: 0.11 }
  }
}

export async function computeCorrelationMatrix(
  tickers: readonly string[],
): Promise<readonly (readonly number[])[]> {
  const cacheKey = tickers.join(',')
  const cached = getCached(correlationCache, cacheKey)
  if (cached) return cached

  try {
    const priceArrays = await Promise.all(tickers.map((t) => getHistoricalPrices(t, 365)))
    const returnArrays = priceArrays.map(computeLogReturns)
    const matrix = computeCorrelationMatrixFromReturns(returnArrays)
    setCache(correlationCache, cacheKey, matrix)
    return matrix
  } catch (error) {
    console.error('Failed to compute correlation matrix:', error)
    // Return identity matrix as fallback (assumes independence)
    const n = tickers.length
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
    )
  }
}

export async function computeEventImpact(
  ticker: string,
  _eventType: string,
): Promise<EventImpactData | null> {
  // For now, return null — real implementation would filter historical prices
  // around known event dates and compute average returns.
  // This is a stretch goal for the eval harness to populate.
  try {
    const prices = await getHistoricalPrices(ticker, 365)
    if (prices.length < 30) return null

    // Compute general statistics as a rough proxy
    const returns = computeLogReturns(prices)
    const avgMove = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const stdDev = standardDeviation(returns)

    return { avgMove, stdDev, sampleSize: returns.length }
  } catch {
    return null
  }
}

export async function getMarketDataForAnalysis(
  tickers: readonly string[],
): Promise<MarketDataBundle> {
  const [volatilities, correlationMatrix] = await Promise.all([
    Promise.all(
      tickers.map(async (t) => {
        const vol = await computeVolatility(t)
        return [t, vol] as const
      }),
    ),
    computeCorrelationMatrix(tickers),
  ])

  const volRecord: Record<string, VolatilityData> = {}
  let source: 'yahoo_finance' | 'fallback' = 'yahoo_finance'

  for (const [ticker, vol] of volatilities) {
    volRecord[ticker] = vol
    // If we used fallback for any ticker, mark source as fallback
    if (FALLBACK_VOLATILITY[ticker] === vol) {
      source = 'fallback'
    }
  }

  return {
    tickers: [...tickers],
    volatilities: volRecord,
    correlationMatrix: correlationMatrix.map((row) => [...row]),
    fetchedAt: new Date().toISOString(),
    source,
  }
}

// ── Testing Exports ──────────────────────────────────────────
export const _testing = {
  computeLogReturns,
  standardDeviation,
  pearsonCorrelation,
  computeVolatilityFromPrices,
  computeCorrelationMatrixFromReturns,
  FALLBACK_VOLATILITY,
}
