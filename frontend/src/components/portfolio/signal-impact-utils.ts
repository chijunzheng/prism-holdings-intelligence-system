import type { Signal, ExposureMap, ExposureEntry } from '@prism/shared'

// ── Shared Impact Types ─────────────────────────────────────

export interface SignalDetail {
  readonly signalId: string
  readonly headline: string
  readonly dollarImpact: number
  readonly sectors: ReadonlyArray<string>
  readonly temporalClassification: string
}

export interface HoldingImpact {
  readonly dollarImpact: number
  readonly direction: 'positive' | 'negative' | 'neutral'
  readonly signalCount: number
  readonly signals: ReadonlyArray<SignalDetail>
  readonly topSector: string | null
  readonly topSectorPct: number
}

export interface SectorImpact {
  readonly category: string
  readonly percentage: number
  readonly dollarImpact: number
  readonly direction: 'positive' | 'negative' | 'neutral'
  readonly signalCount: number
  readonly signalHeadlines: ReadonlyArray<string>
}

export interface PortfolioImpactSummary {
  readonly netDollarImpact: number
  readonly activeSignalCount: number
  readonly affectedEtfCount: number
  readonly totalEtfCount: number
  readonly amplificationInsight: string | null
}

// ── Helpers ─────────────────────────────────────────────────

function getSentimentDirection(signal: Signal): number {
  const narrative = `${signal.headline} ${signal.description}`.toLowerCase()
  const positiveHint = /(strong|beat|growth|upgrade|boost|surge|rally)/.test(narrative)
  const negativeHint = /(tariff|downgrade|decline|drop|risk|tension|shock|selloff)/.test(narrative)
  return positiveHint && !negativeHint ? 1 : -1
}

function getMagnitude(urgency: string): number {
  if (urgency === 'critical') return 0.05
  if (urgency === 'high') return 0.03
  if (urgency === 'medium') return 0.02
  return 0.01
}

export function matchesExposure(affectedExposure: string, category: string): boolean {
  return (
    category.toLowerCase().includes(affectedExposure.toLowerCase()) ||
    affectedExposure.toLowerCase().includes(category.toLowerCase())
  )
}

export function getTemporalLabel(classification: string): string {
  switch (classification) {
    case 'transient': return 'Short-term'
    case 'structural': return 'Long-term'
    case 'ambiguous': return 'Uncertain'
    default: return ''
  }
}

export function formatImpact(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) {
    return `${prefix}$${(abs / 1000).toFixed(1)}k`
  }
  return `${prefix}$${abs.toFixed(0)}`
}

// ── Per-Holding Impact Computation ──────────────────────────

export function computeHoldingImpacts(
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap,
  totalPortfolioValue: number,
): ReadonlyMap<string, HoldingImpact> {
  const impactsByTicker = new Map<string, {
    totalDollar: number
    signalDetails: SignalDetail[]
    topSector: string | null
    topSectorPct: number
  }>()

  const tickerTopSectors = new Map<string, { sector: string; pct: number }>()
  for (const exposure of exposureMap.exposures) {
    for (const h of exposure.contributingHoldings) {
      const existing = tickerTopSectors.get(h.ticker)
      if (!existing || h.contribution > existing.pct) {
        tickerTopSectors.set(h.ticker, { sector: exposure.category, pct: h.contribution })
      }
    }
  }

  for (const signal of signals) {
    const affected = exposureMap.exposures.filter((e) =>
      signal.affectedExposures.some((ae) => matchesExposure(ae, e.category)),
    )

    const direction = getSentimentDirection(signal)
    const magnitude = getMagnitude(signal.urgency)

    const tickerContributions = new Map<string, { dollar: number; sectors: string[] }>()

    for (const exposure of affected) {
      for (const holding of exposure.contributingHoldings) {
        const dollarExposure = (holding.contribution / 100) * totalPortfolioValue
        const impact = dollarExposure * magnitude * direction * signal.relevanceScore
        const existing = tickerContributions.get(holding.ticker)
        if (existing) {
          existing.dollar += impact
          existing.sectors.push(exposure.category)
        } else {
          tickerContributions.set(holding.ticker, {
            dollar: impact,
            sectors: [exposure.category],
          })
        }
      }
    }

    for (const [ticker, data] of tickerContributions) {
      const detail: SignalDetail = {
        signalId: signal.id,
        headline: signal.headline,
        dollarImpact: data.dollar,
        sectors: data.sectors,
        temporalClassification: signal.temporalClassification,
      }

      const existing = impactsByTicker.get(ticker)
      const topSectorInfo = tickerTopSectors.get(ticker)
      if (existing) {
        existing.totalDollar += data.dollar
        existing.signalDetails.push(detail)
      } else {
        impactsByTicker.set(ticker, {
          totalDollar: data.dollar,
          signalDetails: [detail],
          topSector: topSectorInfo?.sector ?? null,
          topSectorPct: topSectorInfo?.pct ?? 0,
        })
      }
    }
  }

  const result = new Map<string, HoldingImpact>()
  for (const [ticker, data] of impactsByTicker) {
    result.set(ticker, {
      dollarImpact: data.totalDollar,
      direction: data.totalDollar > 10 ? 'positive' : data.totalDollar < -10 ? 'negative' : 'neutral',
      signalCount: data.signalDetails.length,
      signals: data.signalDetails,
      topSector: data.topSector,
      topSectorPct: data.topSectorPct,
    })
  }
  return result
}

// ── Per-Sector Impact Computation ───────────────────────────

export function computeSectorImpacts(
  signals: ReadonlyArray<Signal>,
  exposures: ReadonlyArray<ExposureEntry>,
  totalPortfolioValue: number,
): ReadonlyArray<SectorImpact> {
  const sectorMap = new Map<string, {
    dollarImpact: number
    signalIds: Set<string>
    headlines: string[]
  }>()

  for (const signal of signals) {
    const direction = getSentimentDirection(signal)
    const magnitude = getMagnitude(signal.urgency)

    for (const exposure of exposures) {
      const isAffected = signal.affectedExposures.some((ae) =>
        matchesExposure(ae, exposure.category),
      )
      if (!isAffected) continue

      const dollarExposure = (exposure.percentage / 100) * totalPortfolioValue
      const impact = dollarExposure * magnitude * direction * signal.relevanceScore

      const existing = sectorMap.get(exposure.category)
      if (existing) {
        existing.dollarImpact += impact
        if (!existing.signalIds.has(signal.id)) {
          existing.signalIds.add(signal.id)
          existing.headlines.push(signal.headline)
        }
      } else {
        sectorMap.set(exposure.category, {
          dollarImpact: impact,
          signalIds: new Set([signal.id]),
          headlines: [signal.headline],
        })
      }
    }
  }

  return exposures.map((exposure) => {
    const data = sectorMap.get(exposure.category)
    return {
      category: exposure.category,
      percentage: exposure.percentage,
      dollarImpact: data?.dollarImpact ?? 0,
      direction: (data?.dollarImpact ?? 0) > 10 ? 'positive' as const
        : (data?.dollarImpact ?? 0) < -10 ? 'negative' as const
        : 'neutral' as const,
      signalCount: data?.signalIds.size ?? 0,
      signalHeadlines: data?.headlines ?? [],
    }
  })
}

// ── Portfolio-Level Summary ─────────────────────────────────

export function computePortfolioSummary(
  signals: ReadonlyArray<Signal>,
  exposureMap: ExposureMap,
  _totalPortfolioValue: number,
  holdingImpacts: ReadonlyMap<string, HoldingImpact>,
): PortfolioImpactSummary {
  let netDollarImpact = 0
  const affectedTickers = new Set<string>()

  for (const [ticker, impact] of holdingImpacts) {
    netDollarImpact += impact.dollarImpact
    if (impact.direction !== 'neutral') {
      affectedTickers.add(ticker)
    }
  }

  // Count unique tickers across all holdings
  const allTickers = new Set<string>()
  for (const exposure of exposureMap.exposures) {
    for (const h of exposure.contributingHoldings) {
      allTickers.add(h.ticker)
    }
  }

  // Generate amplification insight: check if concentrated sectors are also signal-affected
  let amplificationInsight: string | null = null
  for (const warning of exposureMap.warnings) {
    if (warning.severity !== 'critical' && warning.severity !== 'high') continue
    const isSignalAffected = signals.some((signal) =>
      signal.affectedExposures.some((ae) => matchesExposure(ae, warning.category)),
    )
    if (isSignalAffected) {
      amplificationInsight = `${warning.percentage.toFixed(0)}% ${warning.category} concentration amplifies signal impact`
      break
    }
  }

  return {
    netDollarImpact,
    activeSignalCount: signals.length,
    affectedEtfCount: affectedTickers.size,
    totalEtfCount: allTickers.size,
    amplificationInsight,
  }
}
