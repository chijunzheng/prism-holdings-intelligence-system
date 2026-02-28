// Magnitude Validator — cross-references estimates against real historical volatility
// Pure computation + LLM assessment. Flags any estimate exceeding 2x monthly volatility.

import {
  MagnitudeValidationSchema,
  type MagnitudeValidation,
  type HoldingValidation,
  type HoldingImpactEstimate,
  type VolatilityData,
} from '@prism/shared'

// ── Fallback Bounds by Asset Class ──────────────────────────
const FALLBACK_MONTHLY_VOL: Record<string, number> = {
  equity: 0.05,
  fixed_income: 0.02,
  commodity: 0.08,
  crypto: 0.15,
}

function classifyAsset(ticker: string): string {
  const bondTickers = new Set(['ZAG', 'XBB', 'VSB'])
  const commodityTickers = new Set(['XEG', 'XGD'])
  const cryptoTickers = new Set(['BTCX.B', 'ETHX.B'])

  if (bondTickers.has(ticker)) return 'fixed_income'
  if (commodityTickers.has(ticker)) return 'commodity'
  if (cryptoTickers.has(ticker)) return 'crypto'
  return 'equity'
}

// ── Core Validation ─────────────────────────────────────────
function validateHolding(params: {
  readonly impact: HoldingImpactEstimate
  readonly volatility?: VolatilityData
}): HoldingValidation {
  const { impact, volatility } = params

  const monthlyVol = volatility?.monthly ?? FALLBACK_MONTHLY_VOL[classifyAsset(impact.ticker)] ?? 0.05
  const maxReasonableMove = 2 * monthlyVol // 2x monthly vol as bound
  const estimatedMagnitude = impact.magnitudeScore

  const outOfBounds = estimatedMagnitude > maxReasonableMove
  const calibratedMagnitude = outOfBounds
    ? maxReasonableMove
    : estimatedMagnitude

  return {
    ticker: impact.ticker,
    estimatedMagnitude,
    historicalVolatility: monthlyVol,
    maxReasonableMove,
    outOfBounds,
    calibratedMagnitude,
  }
}

// ── Public API ──────────────────────────────────────────────
export function runMagnitudeValidator(params: {
  readonly holdingImpacts: readonly HoldingImpactEstimate[]
  readonly volatilities: Readonly<Record<string, VolatilityData>>
}): MagnitudeValidation {
  const { holdingImpacts, volatilities } = params

  const holdingValidations: HoldingValidation[] = holdingImpacts.map((impact) => {
    const volatility = volatilities[impact.ticker]
    return validateHolding({ impact, volatility })
  })

  const outOfBoundsFlags = holdingValidations
    .filter((v) => v.outOfBounds)
    .map((v) =>
      `${v.ticker}: estimated magnitude ${(v.estimatedMagnitude * 100).toFixed(1)}% exceeds ` +
      `2x historical volatility bound ${(v.maxReasonableMove * 100).toFixed(1)}%. ` +
      `Clamped to ${(v.calibratedMagnitude * 100).toFixed(1)}%.`,
    )

  const overallAssessment =
    outOfBoundsFlags.length === 0
      ? 'All magnitude estimates are within historical volatility bounds.'
      : `${outOfBoundsFlags.length} holding(s) had estimates exceeding historical bounds and were clamped.`

  const result = {
    holdingValidations,
    outOfBoundsFlags,
    overallAssessment,
  }

  // Validate with Zod
  return MagnitudeValidationSchema.parse(result)
}
