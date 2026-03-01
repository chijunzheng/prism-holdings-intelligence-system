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

// ── Logo Sources ──────────────────────────────────────────

const ELBSTREAM_BASE = 'https://api.elbstream.com/logos/symbol'

// Map tickers to fund provider domains (ETFs don't have their own logos)
const TICKER_DOMAINS: Readonly<Record<string, string>> = {
  VFV: 'vanguard.ca',
  VCN: 'vanguard.ca',
  VAB: 'vanguard.ca',
  VEQT: 'vanguard.ca',
  VGRO: 'vanguard.ca',
  VBAL: 'vanguard.ca',
  XIC: 'blackrock.com',
  XEG: 'blackrock.com',
  XGD: 'blackrock.com',
  XQQ: 'blackrock.com',
  XIU: 'blackrock.com',
  XBB: 'blackrock.com',
  XSP: 'blackrock.com',
  ZAG: 'bmo.com',
  ZEB: 'bmo.com',
  ZDV: 'bmo.com',
  ZSP: 'bmo.com',
  SHOP: 'shopify.com',
  NVDA: 'nvidia.com',
  TSLA: 'tesla.com',
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  GOOG: 'google.com',
  GOOGL: 'google.com',
  AMZN: 'amazon.com',
  META: 'meta.com',
  RY: 'rbc.com',
  TD: 'td.com',
  BNS: 'scotiabank.com',
  BMO: 'bmo.com',
  CM: 'cibc.com',
  ENB: 'enbridge.com',
  CNR: 'cn.ca',
  'BTCX.B': 'bitcoin.org',
}

/**
 * Build ordered list of logo URLs to try for a given ticker.
 * Order: elbstream (ticker) → elbstream (.TO variant) → Clearbit (domain) → Google Favicon (domain)
 */
function buildCandidateUrls(ticker: string): readonly string[] {
  const urls: string[] = []

  // 1. elbstream by ticker symbol
  urls.push(`${ELBSTREAM_BASE}/${encodeURIComponent(ticker)}?format=png`)

  // 2. elbstream with/without .TO suffix (Canadian exchange variant)
  if (ticker.endsWith('.TO')) {
    const withoutSuffix = ticker.slice(0, -3)
    if (withoutSuffix) {
      urls.push(`${ELBSTREAM_BASE}/${encodeURIComponent(withoutSuffix)}?format=png`)
    }
  } else {
    urls.push(`${ELBSTREAM_BASE}/${encodeURIComponent(ticker + '.TO')}?format=png`)
  }

  // 3–4. Domain-based logos for known fund providers
  const domain = TICKER_DOMAINS[ticker]
  if (domain) {
    urls.push(`https://logo.clearbit.com/${domain}?size=80`)
    urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)
  }

  return urls
}

// ── Module-level Cache ────────────────────────────────────

// ticker → resolved image URL (string) or null (all sources failed)
const logoCache = new Map<string, string | null>()

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

// ── Component ─────────────────────────────────────────────

export function TickerIcon({ ticker, size = 32 }: TickerIconProps) {
  const normalizedTicker = useMemo(() => normalizeTicker(ticker), [ticker])
  const candidateUrls = useMemo(() => buildCandidateUrls(normalizedTicker), [normalizedTicker])

  const [logoUrl, setLogoUrl] = useState<string | null>(
    logoCache.get(normalizedTicker) ?? null,
  )
  const [resolved, setResolved] = useState(logoCache.has(normalizedTicker))
  const [attemptIndex, setAttemptIndex] = useState(0)

  // Reset state when ticker changes
  useEffect(() => {
    if (logoCache.has(normalizedTicker)) {
      setLogoUrl(logoCache.get(normalizedTicker) ?? null)
      setAttemptIndex(0)
      setResolved(true)
      return
    }

    if (candidateUrls.length === 0) {
      logoCache.set(normalizedTicker, null)
      setLogoUrl(null)
      setAttemptIndex(0)
      setResolved(true)
      return
    }

    setLogoUrl(null)
    setAttemptIndex(0)
    setResolved(false)
  }, [candidateUrls.length, normalizedTicker])

  const activeUrl = resolved
    ? logoUrl
    : (candidateUrls[attemptIndex] ?? null)

  const handleLoad = useCallback(() => {
    if (!activeUrl) return
    logoCache.set(normalizedTicker, activeUrl)
    setLogoUrl(activeUrl)
    setResolved(true)
  }, [activeUrl, normalizedTicker])

  const handleError = useCallback(() => {
    if (resolved) {
      // Cached URL stopped working — clear and fall back
      logoCache.set(normalizedTicker, null)
      setLogoUrl(null)
      return
    }

    const nextAttempt = attemptIndex + 1
    if (nextAttempt < candidateUrls.length) {
      setAttemptIndex(nextAttempt)
      return
    }

    // All sources exhausted
    logoCache.set(normalizedTicker, null)
    setLogoUrl(null)
    setResolved(true)
  }, [attemptIndex, candidateUrls.length, normalizedTicker, resolved])

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
          position: 'relative',
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          backgroundColor: bg,
          color: '#ffffff',
          fontSize,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
        aria-hidden="true"
      >
        {/* Initials show behind the image as fallback during load */}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initials}
        </span>
        <img
          key={activeUrl}
          src={activeUrl}
          alt=""
          width={size}
          height={size}
          style={{
            position: 'absolute',
            inset: 0,
            objectFit: 'cover',
            width: '100%',
            height: '100%',
          }}
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
