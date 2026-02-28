// Calibration Engine — Formula-based dollar impact anchoring
// Converts LLM qualitative assessments (direction + magnitude 0-1)
// into bounded, defensible dollar ranges using real market data.
// The LLM never picks dollar amounts — this formula does.

import type { DollarRange, VolatilityData } from '@prism/shared'

// ── Time Horizon Multipliers ─────────────────────────────────
const TIME_MULTIPLIERS: Record<string, number> = {
  '1W': 0.25,
  '1M': 1.0,
  '6M': 2.5,
}

export function getTimeMultiplier(horizon: string): number {
  return TIME_MULTIPLIERS[horizon] ?? 1.0
}

// ── Fallback Volatility Bounds ───────────────────────────────
// Used when Yahoo Finance data is unavailable
const FALLBACK_MONTHLY_VOL: Record<string, number> = {
  equity: 0.05,
  fixed_income: 0.02,
  commodity: 0.08,
  crypto: 0.15,
  mixed: 0.04,
}

export function getFallbackVolatility(assetClass: string): number {
  return FALLBACK_MONTHLY_VOL[assetClass] ?? 0.05
}

// ── Core Calibration Formula ─────────────────────────────────
export function calibrateImpact(params: {
  readonly holdingValueCad: number
  readonly analystDirectionConsensus: number // -1 to +1
  readonly analystMagnitudeConsensus: number // 0 to 1
  readonly riskChallengeHaircut: number // -0.5 to 0
  readonly computedVolatility: number // Monthly volatility as decimal
  readonly historicalEventImpact?: number // Average move on similar events
  readonly historicalSampleSize?: number // Number of similar events
  readonly timeHorizon: string // '1W', '1M', '6M'
}): DollarRange {
  const {
    holdingValueCad,
    analystDirectionConsensus,
    analystMagnitudeConsensus,
    riskChallengeHaircut,
    computedVolatility,
    historicalEventImpact,
    historicalSampleSize,
    timeHorizon,
  } = params

  if (holdingValueCad <= 0) {
    return { low: 0, mid: 0, high: 0 }
  }

  const timeMultiplier = getTimeMultiplier(timeHorizon)

  // Step 1: Apply haircut to magnitude
  const adjustedMagnitude = analystMagnitudeConsensus * (1 + riskChallengeHaircut)
  const clampedMagnitude = Math.max(0, Math.min(1, adjustedMagnitude))

  // Step 2: Compute volatility-based maximum move
  const maxMovePercent = 2 * computedVolatility * timeMultiplier
  const maxMoveDollar = maxMovePercent * holdingValueCad

  // Step 3: Compute raw impact
  let midEstimate: number

  // Anchor to historical event impact if available and sample size is sufficient
  if (
    historicalEventImpact !== undefined &&
    historicalSampleSize !== undefined &&
    historicalSampleSize >= 5
  ) {
    midEstimate =
      holdingValueCad * historicalEventImpact * Math.sign(analystDirectionConsensus) * timeMultiplier
  } else {
    midEstimate =
      holdingValueCad * clampedMagnitude * analystDirectionConsensus * timeMultiplier
  }

  // Step 4: Clamp to volatility bounds
  const clampedMid = Math.max(-maxMoveDollar, Math.min(maxMoveDollar, midEstimate))

  // Step 5: Compute range (low = conservative, high = upper bound)
  const low = clampedMid * 0.5
  const high = clampedMid * 1.8

  // Step 6: Hard ceiling — can't exceed holding value
  return clampToHoldingValue({ low, mid: clampedMid, high }, holdingValueCad)
}

function clampToHoldingValue(range: DollarRange, holdingValue: number): DollarRange {
  const maxLoss = -holdingValue
  const maxGain = holdingValue

  return {
    low: Math.max(maxLoss, Math.min(maxGain, range.low)),
    mid: Math.max(maxLoss, Math.min(maxGain, range.mid)),
    high: Math.max(maxLoss, Math.min(maxGain, range.high)),
  }
}

// ── Portfolio-Level Aggregation ──────────────────────────────
// Uses correlation matrix for more accurate portfolio-level impact
export function aggregateHoldingImpacts(params: {
  readonly holdingImpacts: readonly { readonly ticker: string; readonly mid: number; readonly volatility: number }[]
  readonly correlationMatrix: readonly (readonly number[])[]
  readonly tickerIndexMap: ReadonlyMap<string, number>
}): DollarRange {
  const { holdingImpacts, correlationMatrix, tickerIndexMap } = params

  if (holdingImpacts.length === 0) {
    return { low: 0, mid: 0, high: 0 }
  }

  // Simple sum for mid
  const midSum = holdingImpacts.reduce((sum, h) => sum + h.mid, 0)

  // Portfolio variance using correlation matrix: σ_p² = Σ Σ w_i w_j σ_i σ_j ρ_ij
  let portfolioVariance = 0
  for (const impactI of holdingImpacts) {
    const idxI = tickerIndexMap.get(impactI.ticker)
    if (idxI === undefined) continue

    for (const impactJ of holdingImpacts) {
      const idxJ = tickerIndexMap.get(impactJ.ticker)
      if (idxJ === undefined) continue

      const correlation = correlationMatrix[idxI]?.[idxJ] ?? (idxI === idxJ ? 1 : 0)
      portfolioVariance += Math.abs(impactI.mid) * Math.abs(impactJ.mid) * correlation
    }
  }

  const portfolioStdDev = Math.sqrt(Math.max(0, portfolioVariance))

  return {
    low: midSum - 1.5 * portfolioStdDev,
    mid: midSum,
    high: midSum + 1.5 * portfolioStdDev,
  }
}

// ── Calibrate All Holdings ───────────────────────────────────
export function calibrateAllHoldings(params: {
  readonly holdings: readonly {
    readonly ticker: string
    readonly name: string
    readonly valueCad: number
    readonly direction: number
    readonly magnitudeScore: number
    readonly confidence: number
  }[]
  readonly volatilities: Readonly<Record<string, VolatilityData>>
  readonly riskChallengeHaircut: number
  readonly timeHorizon: string
  readonly historicalEventImpacts?: Readonly<
    Record<string, { avgMove: number; sampleSize: number }>
  >
}): readonly {
  readonly ticker: string
  readonly name: string
  readonly holdingValueCad: number
  readonly impact: DollarRange
  readonly derivation: string
}[] {
  const { holdings, volatilities, riskChallengeHaircut, timeHorizon, historicalEventImpacts } =
    params

  return holdings.map((holding) => {
    const vol = volatilities[holding.ticker]?.monthly ?? getFallbackVolatility('equity')
    const eventImpact = historicalEventImpacts?.[holding.ticker]

    const impact = calibrateImpact({
      holdingValueCad: holding.valueCad,
      analystDirectionConsensus: holding.direction,
      analystMagnitudeConsensus: holding.magnitudeScore,
      riskChallengeHaircut,
      computedVolatility: vol,
      historicalEventImpact: eventImpact?.avgMove,
      historicalSampleSize: eventImpact?.sampleSize,
      timeHorizon,
    })

    const volSource = volatilities[holding.ticker] ? 'Yahoo Finance' : 'fallback'
    const derivation =
      `$${holding.valueCad.toLocaleString()} × ${(holding.magnitudeScore * 100).toFixed(0)}% magnitude × ` +
      `${holding.direction > 0 ? '+' : ''}${holding.direction.toFixed(2)} direction. ` +
      `Vol: ${(vol * 100).toFixed(1)}% monthly (${volSource}). ` +
      `Haircut: ${(riskChallengeHaircut * 100).toFixed(0)}%.` +
      (eventImpact ? ` Anchored to historical: ${(eventImpact.avgMove * 100).toFixed(1)}% (n=${eventImpact.sampleSize}).` : '')

    return {
      ticker: holding.ticker,
      name: holding.name,
      holdingValueCad: holding.valueCad,
      impact,
      derivation,
    }
  })
}
