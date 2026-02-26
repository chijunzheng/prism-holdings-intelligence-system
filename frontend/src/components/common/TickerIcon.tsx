import { useCallback, useEffect, useMemo, useState } from 'react'

interface TickerIconProps {
  readonly ticker: string
  readonly size?: number
}

const ICON_COLORS = [
  '#1a1a1a', '#2563eb', '#7c3aed', '#c2410c', '#0891b2',
  '#4f46e5', '#be185d', '#0d9488', '#b91c1c', '#4338ca',
] as const

function colorForTicker(ticker: string): string {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length]
}

function initialsForTicker(ticker: string): string {
  return ticker.slice(0, 2).toUpperCase()
}

const BASE_URL = 'https://api.elbstream.com/logos/symbol'
const FAILED_SYMBOL_STORAGE_KEY = 'prism.logo.failedSymbols.v1'
const KNOWN_UNAVAILABLE_SYMBOLS = new Set<string>()

// Module-level cache: ticker → resolved image URL or null (failed)
const logoCache = new Map<string, string | null>()
const failedSymbolCache = new Set<string>()
let failedSymbolsHydrated = false

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function hydrateFailedSymbols(): void {
  if (failedSymbolsHydrated) return
  failedSymbolsHydrated = true

  // Clear stale v1 cache that incorrectly blocked Canadian ETF symbols
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(FAILED_SYMBOL_STORAGE_KEY)
  }

  for (const symbol of KNOWN_UNAVAILABLE_SYMBOLS) {
    failedSymbolCache.add(symbol)
  }

  if (typeof window === 'undefined') return
  const raw = window.localStorage.getItem(FAILED_SYMBOL_STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    for (const entry of parsed) {
      if (typeof entry !== 'string') continue
      const symbol = normalizeTicker(entry)
      if (symbol) failedSymbolCache.add(symbol)
    }
  } catch {
    // Ignore malformed localStorage values.
  }
}

function persistFailedSymbols(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAILED_SYMBOL_STORAGE_KEY, JSON.stringify(Array.from(failedSymbolCache)))
  } catch {
    // Ignore storage quota/access issues.
  }
}

function markSymbolFailed(symbol: string): void {
  const normalized = normalizeTicker(symbol)
  if (!normalized) return
  hydrateFailedSymbols()
  if (failedSymbolCache.has(normalized)) return
  failedSymbolCache.add(normalized)
  persistFailedSymbols()
}

function isSymbolBlocked(symbol: string): boolean {
  const normalized = normalizeTicker(symbol)
  if (!normalized) return true
  hydrateFailedSymbols()
  return failedSymbolCache.has(normalized)
}

/**
 * Builds candidate symbols in lookup order.
 * Example: "XIC" => ["XIC", "XIC.TO"], "XIC.TO" => ["XIC.TO", "XIC"]
 */
function buildCandidateSymbols(ticker: string): ReadonlyArray<string> {
  if (!ticker) return []

  const symbols = new Set<string>()
  symbols.add(ticker)

  if (ticker.endsWith('.TO')) {
    const withoutSuffix = ticker.slice(0, -3)
    if (withoutSuffix) symbols.add(withoutSuffix)
  } else {
    symbols.add(`${ticker}.TO`)
  }

  return Array.from(symbols).filter((symbol) => !isSymbolBlocked(symbol))
}

function toLogoUrl(symbol: string): string {
  return `${BASE_URL}/${encodeURIComponent(symbol)}?format=png`
}

export function TickerIcon({ ticker, size = 32 }: TickerIconProps) {
  const normalizedTicker = useMemo(() => normalizeTicker(ticker), [ticker])
  const candidates = useMemo(() => buildCandidateSymbols(normalizedTicker), [normalizedTicker])

  const [logoUrl, setLogoUrl] = useState<string | null>(
    logoCache.get(normalizedTicker) ?? null,
  )
  const [resolved, setResolved] = useState(logoCache.has(normalizedTicker))
  const [attemptIndex, setAttemptIndex] = useState(0)

  useEffect(() => {
    if (logoCache.has(normalizedTicker)) {
      setLogoUrl(logoCache.get(normalizedTicker) ?? null)
      setAttemptIndex(0)
      setResolved(true)
      return
    }

    if (candidates.length === 0) {
      if (normalizedTicker) logoCache.set(normalizedTicker, null)
      setLogoUrl(null)
      setAttemptIndex(0)
      setResolved(true)
      return
    }

    setLogoUrl(null)
    setAttemptIndex(0)
    setResolved(false)
  }, [candidates.length, normalizedTicker])

  const activeSymbol = !resolved ? candidates[attemptIndex] ?? null : null
  const activeUrl = logoUrl ?? (activeSymbol ? toLogoUrl(activeSymbol) : null)

  const markFallback = useCallback(() => {
    if (normalizedTicker) logoCache.set(normalizedTicker, null)
    setLogoUrl(null)
    setResolved(true)
  }, [normalizedTicker])

  const handleLoad = useCallback(() => {
    if (!activeUrl) return
    if (normalizedTicker) logoCache.set(normalizedTicker, activeUrl)
    setLogoUrl(activeUrl)
    setResolved(true)
  }, [activeUrl, normalizedTicker])

  const handleError = useCallback(() => {
    if (activeSymbol) {
      markSymbolFailed(activeSymbol)
    }

    if (resolved) {
      markFallback()
      return
    }

    const nextAttempt = attemptIndex + 1
    if (nextAttempt < candidates.length) {
      setAttemptIndex(nextAttempt)
      return
    }

    markFallback()
  }, [activeSymbol, attemptIndex, candidates.length, markFallback, resolved])

  const bg = colorForTicker(normalizedTicker || ticker)
  const initials = initialsForTicker(normalizedTicker || ticker)
  const fontSize = size * 0.38

  if (activeUrl) {
    return (
      <span
        className="ticker-icon"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          backgroundColor: '#f5f5f5',
        }}
        aria-hidden="true"
      >
        <img
          key={activeUrl}
          src={activeUrl}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      </span>
    )
  }

  // Fallback: colored initials circle
  return (
    <span
      className="ticker-icon"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: resolved ? bg : '#e5e5e5',
        color: '#ffffff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        flexShrink: 0,
        transition: 'background-color 0.2s',
      }}
      aria-hidden="true"
    >
      {resolved ? initials : ''}
    </span>
  )
}
