// Live Quotes — fetches today's price change from Yahoo Finance v8 chart API.
// Short-lived cache (5 min) keeps quotes fresh without hammering the API.
// Falls back gracefully to static portfolio data if unavailable.

import type { Portfolio } from '@prism/shared'

type Quote = {
  readonly ticker: string
  readonly price: number
  readonly prevClose: number
  readonly dayChangeCad: number
  readonly dayChangePct: number
}

type CacheEntry = {
  readonly quotes: ReadonlyMap<string, Quote>
  readonly expiresAt: number
}

const QUOTE_TTL_MS = 5 * 60 * 1000 // 5 minutes
let quoteCache: CacheEntry | null = null

// Canadian tickers that need .TO suffix for Yahoo Finance
const CANADIAN_TICKERS = new Set([
  'VFV', 'XIC', 'ZAG', 'ZEB', 'XEG', 'XGD', 'XQQ', 'ZDV',
  'SHOP', 'RY', 'ENB', 'BTCX.B',
])

function toYahooTicker(ticker: string): string {
  if (CANADIAN_TICKERS.has(ticker)) {
    return `${ticker.replace('.', '-')}.TO`
  }
  return ticker
}

/** Fetch a single ticker's recent prices via the v8 chart API (no auth required). */
async function fetchTickerQuote(ticker: string): Promise<Quote | null> {
  const yahooTicker = toYahooTicker(ticker)
  // Fetch 5 days to handle weekends/holidays — we only need the last 2 trading days
  const period2 = Math.floor(Date.now() / 1000)
  const period1 = period2 - 5 * 24 * 60 * 60
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}` +
    `?period1=${period1}&period2=${period2}&interval=1d`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
  })

  if (!response.ok) return null

  const data = (await response.json()) as {
    chart: {
      result: {
        meta: { regularMarketPrice: number; chartPreviousClose: number }
        timestamp: number[]
        indicators: {
          quote: { close: (number | null)[] }[]
        }
      }[]
    }
  }

  const result = data.chart.result?.[0]
  if (!result) return null

  const currentPrice = result.meta.regularMarketPrice
  const prevClose = result.meta.chartPreviousClose
  const dayChange = currentPrice - prevClose
  const dayChangePct = prevClose > 0 ? (dayChange / prevClose) * 100 : 0

  return {
    ticker,
    price: currentPrice,
    prevClose,
    dayChangeCad: dayChange,
    dayChangePct,
  }
}

/** Fetch quotes for all tickers in parallel. */
async function fetchQuotesBatch(tickers: readonly string[]): Promise<ReadonlyMap<string, Quote>> {
  const results = await Promise.allSettled(
    tickers.map((t) => fetchTickerQuote(t)),
  )

  const quotes = new Map<string, Quote>()
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      quotes.set(result.value.ticker, result.value)
    }
  }
  return quotes
}

async function getQuotes(tickers: readonly string[]): Promise<ReadonlyMap<string, Quote>> {
  if (quoteCache && Date.now() < quoteCache.expiresAt) {
    const allCached = tickers.every((t) => quoteCache!.quotes.has(t))
    if (allCached) return quoteCache.quotes
  }

  try {
    const quotes = await fetchQuotesBatch(tickers)
    quoteCache = { quotes, expiresAt: Date.now() + QUOTE_TTL_MS }
    return quotes
  } catch (error) {
    console.error('Failed to fetch live quotes:', error)
    return quoteCache?.quotes ?? new Map()
  }
}

/** Enrich a portfolio with live daily change data from Yahoo Finance. */
export async function enrichPortfolioWithLiveQuotes(portfolio: Portfolio): Promise<Portfolio> {
  const allTickers = portfolio.accounts.flatMap((a) => a.holdings.map((h) => h.ticker))
  const uniqueTickers = [...new Set(allTickers)]

  const quotes = await getQuotes(uniqueTickers)

  if (quotes.size === 0) {
    return portfolio
  }

  return {
    ...portfolio,
    accounts: portfolio.accounts.map((account) => ({
      ...account,
      holdings: account.holdings.map((holding) => {
        const quote = quotes.get(holding.ticker)
        if (!quote) return holding

        const liveValue = Math.round(quote.price * holding.units * 100) / 100
        const totalDayChange = quote.dayChangeCad * holding.units
        return {
          ...holding,
          valueCad: liveValue,
          dayChangeCad: Math.round(totalDayChange * 100) / 100,
          dayChangePct: Math.round(quote.dayChangePct * 100) / 100,
        }
      }),
    })),
    totalValueCad: Math.round(
      portfolio.accounts.reduce(
        (sum, a) => sum + a.holdings.reduce((s, h) => {
          const quote = quotes.get(h.ticker)
          return s + (quote ? quote.price * h.units : h.valueCad)
        }, 0),
        0,
      ) * 100,
    ) / 100,
    lastUpdated: new Date().toISOString(),
  }
}
