import { describe, it, expect } from 'vitest'
import {
  classifyActualDirection,
  isDirectionallyAccurate,
  holdingDirectionalAccuracy,
  isWithinRange,
  computeDirectionalAccuracy,
  computeRangeCoverage,
  computePerEventTypeMetrics,
} from '../metrics'
import type { EvalResult } from '../types'

// ── classifyActualDirection ────────────────────────────────

describe('classifyActualDirection', () => {
  it('classifies positive average returns as positive', () => {
    expect(classifyActualDirection({ VFV: 0.02, XIC: 0.015 })).toBe('positive')
  })

  it('classifies negative average returns as negative', () => {
    expect(classifyActualDirection({ VFV: -0.058, XIC: -0.042 })).toBe('negative')
  })

  it('classifies near-zero returns as neutral', () => {
    expect(classifyActualDirection({ VFV: 0.002, XIC: -0.003 })).toBe('neutral')
  })

  it('handles empty record as neutral', () => {
    expect(classifyActualDirection({})).toBe('neutral')
  })

  it('handles mixed returns — net positive', () => {
    // avg = (0.05 + -0.01) / 2 = 0.02
    expect(classifyActualDirection({ VFV: 0.05, XIC: -0.01 })).toBe('positive')
  })
})

// ── isDirectionallyAccurate ────────────────────────────────

describe('isDirectionallyAccurate', () => {
  it('positive prediction matches positive actual', () => {
    expect(isDirectionallyAccurate('positive', 'positive')).toBe(true)
  })

  it('negative prediction matches negative actual', () => {
    expect(isDirectionallyAccurate('negative', 'negative')).toBe(true)
  })

  it('positive prediction does not match negative actual', () => {
    expect(isDirectionallyAccurate('positive', 'negative')).toBe(false)
  })

  it('mixed prediction matches any actual', () => {
    expect(isDirectionallyAccurate('mixed', 'positive')).toBe(true)
    expect(isDirectionallyAccurate('mixed', 'negative')).toBe(true)
  })

  it('any prediction matches neutral actual', () => {
    expect(isDirectionallyAccurate('positive', 'neutral')).toBe(true)
    expect(isDirectionallyAccurate('negative', 'neutral')).toBe(true)
  })
})

// ── holdingDirectionalAccuracy ─────────────────────────────

describe('holdingDirectionalAccuracy', () => {
  it('all correct directions → 1.0', () => {
    const predicted = new Map([['VFV', -0.5], ['XIC', -0.3]])
    const actual = { VFV: -0.02, XIC: -0.015 }
    expect(holdingDirectionalAccuracy(predicted, actual)).toBe(1)
  })

  it('all wrong directions → 0.0', () => {
    const predicted = new Map([['VFV', 0.5], ['XIC', 0.3]])
    const actual = { VFV: -0.02, XIC: -0.015 }
    expect(holdingDirectionalAccuracy(predicted, actual)).toBe(0)
  })

  it('half correct → 0.5', () => {
    const predicted = new Map([['VFV', -0.5], ['XIC', 0.3]])
    const actual = { VFV: -0.02, XIC: -0.015 }
    expect(holdingDirectionalAccuracy(predicted, actual)).toBe(0.5)
  })

  it('neutral actual is always correct', () => {
    const predicted = new Map([['VFV', -0.5]])
    const actual = { VFV: 0.001 } // Below neutral threshold
    expect(holdingDirectionalAccuracy(predicted, actual)).toBe(1)
  })

  it('ignores holdings not in actual returns', () => {
    const predicted = new Map([['VFV', -0.5], ['FAKE', 0.3]])
    const actual = { VFV: -0.02 }
    expect(holdingDirectionalAccuracy(predicted, actual)).toBe(1) // Only VFV counted
  })
})

// ── isWithinRange ──────────────────────────────────────────

describe('isWithinRange', () => {
  it('value within range → true', () => {
    expect(isWithinRange({ low: -500, high: 200 }, -100)).toBe(true)
  })

  it('value below range → false', () => {
    expect(isWithinRange({ low: -500, high: 200 }, -600)).toBe(false)
  })

  it('value above range → false', () => {
    expect(isWithinRange({ low: -500, high: 200 }, 300)).toBe(false)
  })

  it('value at boundary → true', () => {
    expect(isWithinRange({ low: -500, high: 200 }, -500)).toBe(true)
    expect(isWithinRange({ low: -500, high: 200 }, 200)).toBe(true)
  })
})

// ── Aggregate Metrics ──────────────────────────────────────

function makeResult(overrides: Partial<EvalResult> & {
  eventId: string
  eventType: EvalResult['eventType']
}): EvalResult {
  return {
    multiAgent: {
      direction: 'negative',
      dollarImpactRange: { low: -500, high: -100 },
      holdingDirections: new Map(),
      qualityScore: 0.7,
    },
    singleAgent: {
      direction: 'negative',
      dollarImpactRange: { low: -800, high: 200 },
      holdingDirections: new Map(),
    },
    actual: {
      returns5d: { VFV: -0.02, XIC: -0.015 },
      netDirection: 'negative',
    },
    ...overrides,
  }
}

describe('computeDirectionalAccuracy', () => {
  it('all correct → 1.0', () => {
    const results = [
      makeResult({ eventId: 'a', eventType: 'rate_decision' }),
      makeResult({ eventId: 'b', eventType: 'oil_shock' }),
    ]
    expect(computeDirectionalAccuracy(results, 'multiAgent')).toBe(1)
  })

  it('half correct → 0.5', () => {
    const results = [
      makeResult({ eventId: 'a', eventType: 'rate_decision' }),
      makeResult({
        eventId: 'b',
        eventType: 'oil_shock',
        multiAgent: {
          direction: 'positive',
          dollarImpactRange: { low: 100, high: 500 },
          holdingDirections: new Map(),
          qualityScore: 0.6,
        },
      }),
    ]
    expect(computeDirectionalAccuracy(results, 'multiAgent')).toBe(0.5)
  })
})

describe('computeRangeCoverage', () => {
  it('computes coverage correctly', () => {
    // actual returns: VFV: -0.02, XIC: -0.015 → net return = -0.035
    // dollar impact = -0.035 * 40000 = -1400
    const results = [
      makeResult({
        eventId: 'a',
        eventType: 'rate_decision',
        multiAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -2000, high: 0 }, // covers -1400
          holdingDirections: new Map(),
          qualityScore: 0.7,
        },
      }),
      makeResult({
        eventId: 'b',
        eventType: 'oil_shock',
        multiAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -500, high: -100 }, // does NOT cover -1400
          holdingDirections: new Map(),
          qualityScore: 0.7,
        },
      }),
    ]
    expect(computeRangeCoverage(results, 'multiAgent')).toBe(0.5)
  })
})

describe('computePerEventTypeMetrics', () => {
  it('groups by event type', () => {
    const results = [
      makeResult({ eventId: 'a', eventType: 'rate_decision' }),
      makeResult({ eventId: 'b', eventType: 'rate_decision' }),
      makeResult({ eventId: 'c', eventType: 'oil_shock' }),
    ]
    const perType = computePerEventTypeMetrics(results, 'multiAgent')
    expect(perType.has('rate_decision')).toBe(true)
    expect(perType.has('oil_shock')).toBe(true)
    expect(perType.has('banking_stress')).toBe(false)
  })
})
