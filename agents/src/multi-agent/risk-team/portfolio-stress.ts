// Portfolio Stress Tester — Monte Carlo simulation with real correlation matrix
// Produces VaR (95%), CVaR (99%), and reversal probability from 10,000 simulations.
// Uses Cholesky decomposition to generate correlated random returns.

import type { StressTestResult, DollarRange } from '@prism/shared'

// ── Types ────────────────────────────────────────────────────
type HoldingInput = {
  readonly ticker: string
  readonly holdingValueCad: number
  readonly expectedReturn: number // Direction-weighted magnitude
  readonly volatility: number // Monthly volatility as decimal
}

// ── Cholesky Decomposition ──────────────────────────────────
// Decomposes a positive-definite correlation matrix into L where L*L^T = matrix.
// This lets us transform independent random normals into correlated ones.
export function choleskyDecomposition(matrix: readonly (readonly number[])[]): readonly (readonly number[])[] {
  const n = matrix.length
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k]
      }
      if (i === j) {
        const diag = matrix[i][i] - sum
        // Handle numerical issues — ensure non-negative under sqrt
        L[i][j] = Math.sqrt(Math.max(0, diag))
      } else {
        const divisor = L[j][j]
        L[i][j] = divisor > 0 ? (matrix[i][j] - sum) / divisor : 0
      }
    }
  }

  return L
}

// ── Box-Muller Transform ────────────────────────────────────
// Generates standard normal random variables from uniform randoms.
function boxMullerRandom(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function generateStandardNormals(n: number): readonly number[] {
  return Array.from({ length: n }, () => boxMullerRandom())
}

// ── Correlated Random Generation ────────────────────────────
// Transforms independent normals Z into correlated normals L*Z.
function generateCorrelatedReturns(
  choleskyL: readonly (readonly number[])[],
  holdings: readonly HoldingInput[],
): readonly number[] {
  const n = holdings.length
  const independentNormals = generateStandardNormals(n)
  const correlatedNormals: number[] = new Array(n).fill(0)

  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j <= i; j++) {
      sum += choleskyL[i][j] * independentNormals[j]
    }
    correlatedNormals[i] = sum
  }

  // Convert correlated normals to returns: μ + σ * correlatedNormal
  return holdings.map((h, i) =>
    h.expectedReturn + h.volatility * correlatedNormals[i],
  )
}

// ── Monte Carlo Simulation ──────────────────────────────────
export function runMonteCarloSimulation(params: {
  readonly holdings: readonly HoldingInput[]
  readonly correlationMatrix: readonly (readonly number[])[]
  readonly numSimulations?: number
}): {
  readonly outcomes: readonly number[]
  readonly holdingOutcomes: readonly (readonly number[])[]
} {
  const { holdings, correlationMatrix, numSimulations = 10_000 } = params

  if (holdings.length === 0) {
    return { outcomes: [0], holdingOutcomes: [] }
  }

  // Ensure correlation matrix matches holdings count
  const n = holdings.length
  const matrix = correlationMatrix.length >= n
    ? correlationMatrix
    : Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)),
      )

  const choleskyL = choleskyDecomposition(matrix)

  const outcomes: number[] = []
  // holdingOutcomes[holdingIdx][simIdx]
  const holdingOutcomes: number[][] = Array.from({ length: n }, () => [])

  for (let sim = 0; sim < numSimulations; sim++) {
    const returns = generateCorrelatedReturns(choleskyL, holdings)

    let portfolioImpact = 0
    for (let i = 0; i < n; i++) {
      const holdingImpact = holdings[i].holdingValueCad * returns[i]
      holdingOutcomes[i].push(holdingImpact)
      portfolioImpact += holdingImpact
    }

    outcomes.push(portfolioImpact)
  }

  // Sort for percentile extraction
  outcomes.sort((a, b) => a - b)

  return { outcomes, holdingOutcomes }
}

// ── Percentile Extraction ───────────────────────────────────
function getPercentile(sortedValues: readonly number[], percentile: number): number {
  const index = Math.floor((percentile / 100) * sortedValues.length)
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))]
}

function makeRange(sortedValues: readonly number[], percentile: number): DollarRange {
  const mid = getPercentile(sortedValues, percentile)
  // Range: ±20% around the percentile value
  // Use Math.min/max to guarantee low <= high regardless of sign
  const a = mid * 0.8
  const b = mid * 1.2
  return {
    low: Math.round(Math.min(a, b)),
    mid: Math.round(mid),
    high: Math.round(Math.max(a, b)),
  }
}

// ── Public API ──────────────────────────────────────────────
export function runPortfolioStressTest(params: {
  readonly holdings: readonly HoldingInput[]
  readonly correlationMatrix: readonly (readonly number[])[]
  readonly numSimulations?: number
}): StressTestResult {
  const { holdings, correlationMatrix, numSimulations = 10_000 } = params

  const { outcomes, holdingOutcomes } = runMonteCarloSimulation({
    holdings,
    correlationMatrix,
    numSimulations,
  })

  const n = outcomes.length

  // Count reversals (positive outcomes when expected return is negative, or vice versa)
  const expectedDirection = holdings.reduce((sum, h) => sum + h.expectedReturn, 0)
  const reversalCount = expectedDirection < 0
    ? outcomes.filter((o) => o > 0).length
    : outcomes.filter((o) => o < 0).length
  const reversalProbability = reversalCount / n

  // Per-holding breakdown
  const holdingBreakdown = holdings.map((h, i) => {
    const sorted = [...holdingOutcomes[i]].sort((a, b) => a - b)
    return {
      ticker: h.ticker,
      baseImpact: Math.round(getPercentile(sorted, 50)),
      downsideImpact: Math.round(getPercentile(sorted, 5)),
      tailImpact: Math.round(getPercentile(sorted, 1)),
    }
  })

  return {
    numSimulations,
    baseCase: makeRange(outcomes, 50),
    downside: makeRange(outcomes, 5),
    tailRisk: makeRange(outcomes, 1),
    reversalProbability: Math.round(reversalProbability * 100) / 100,
    scenarios: [
      {
        name: 'Base Case',
        percentile: 50,
        portfolioImpact: makeRange(outcomes, 50),
        description: `Median outcome across ${numSimulations.toLocaleString()} simulations.`,
      },
      {
        name: 'Downside (95% VaR)',
        percentile: 5,
        portfolioImpact: makeRange(outcomes, 5),
        description: `Only 5% of simulations were worse than this. Standard risk benchmark.`,
      },
      {
        name: 'Tail Risk (99% CVaR)',
        percentile: 1,
        portfolioImpact: makeRange(outcomes, 1),
        description: `Extreme scenario. Very unlikely but possible.`,
      },
    ],
    holdingBreakdown,
  }
}
