import { describe, it, expect } from 'vitest'
import {
  classifyActualDirection,
  isDirectionallyAccurate,
  holdingDirectionalAccuracy,
  isWithinRange,
  computeDirectionalAccuracy,
  computeRangeCoverage,
  computePerEventTypeMetrics,
  computeAverageJudgeScore,
} from '../metrics'
import type { EvalResult, JudgeScore } from '../types'

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

  it('mixed prediction only matches neutral actual', () => {
    expect(isDirectionallyAccurate('mixed', 'neutral')).toBe(true)
    expect(isDirectionallyAccurate('mixed', 'positive')).toBe(false)
    expect(isDirectionallyAccurate('mixed', 'negative')).toBe(false)
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
      reasoning: 'Multi-agent reasoning text',
    },
    singleAgent: {
      direction: 'negative',
      dollarImpactRange: { low: -800, high: 200 },
      holdingDirections: new Map(),
      reasoning: 'Single-agent reasoning text',
    },
    pro25SingleAgent: {
      direction: 'negative',
      dollarImpactRange: { low: -700, high: 100 },
      holdingDirections: new Map(),
      reasoning: 'Flash 3 single-agent reasoning text',
    },
    tradingAgents: {
      direction: 'negative',
      dollarImpactRange: { low: -5000, high: 5000 },
      holdingDirections: new Map(),
      reasoning: 'TradingAgents reasoning text',
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
          reasoning: 'Wrong direction reasoning',
        },
      }),
    ]
    expect(computeDirectionalAccuracy(results, 'multiAgent')).toBe(0.5)
  })

  it('works for pro25SingleAgent system key', () => {
    const results = [
      makeResult({ eventId: 'a', eventType: 'rate_decision' }),
    ]
    expect(computeDirectionalAccuracy(results, 'pro25SingleAgent')).toBe(1)
  })
})

describe('computeRangeCoverage', () => {
  it('computes coverage correctly', () => {
    // actual returns: VFV: -0.02, XIC: -0.015 → 2 holdings, $30k each
    // dollar impact = (-0.02 * 30000) + (-0.015 * 30000) = -600 + -450 = -1050
    const results = [
      makeResult({
        eventId: 'a',
        eventType: 'rate_decision',
        multiAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -1500, high: 0 }, // covers -1050
          holdingDirections: new Map(),
          qualityScore: 0.7,
          reasoning: 'Covered range reasoning',
        },
      }),
      makeResult({
        eventId: 'b',
        eventType: 'oil_shock',
        multiAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -500, high: -100 }, // does NOT cover -1050
          holdingDirections: new Map(),
          qualityScore: 0.7,
          reasoning: 'Narrow range reasoning',
        },
      }),
    ]
    expect(computeRangeCoverage(results, 'multiAgent')).toBe(0.5)
  })

  it('works for pro25SingleAgent', () => {
    const results = [
      makeResult({
        eventId: 'a',
        eventType: 'rate_decision',
        pro25SingleAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -1500, high: 0 }, // covers -1050
          holdingDirections: new Map(),
          reasoning: 'Covered',
        },
      }),
    ]
    expect(computeRangeCoverage(results, 'pro25SingleAgent')).toBe(1)
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

// ── Judge Score Averaging ──────────────────────────────────

describe('computeAverageJudgeScore', () => {
  const mockScore: JudgeScore = {
    causalReasoning: 4,
    calibration: 3,
    riskIdentification: 3,
    recommendationQuality: 0,
    transparency: 2,
    overall: 2.4,
  }

  it('returns undefined when no judge scores exist', () => {
    const results = [makeResult({ eventId: 'a', eventType: 'rate_decision' })]
    expect(computeAverageJudgeScore(results, 'singleAgent')).toBeUndefined()
  })

  it('averages judge scores across events', () => {
    const score2: JudgeScore = {
      causalReasoning: 2,
      calibration: 3,
      riskIdentification: 5,
      recommendationQuality: 0,
      transparency: 4,
      overall: 2.8,
    }
    const results = [
      makeResult({
        eventId: 'a',
        eventType: 'rate_decision',
        singleAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -800, high: 200 },
          holdingDirections: new Map(),
          reasoning: 'test',
          judgeScore: mockScore,
        },
      }),
      makeResult({
        eventId: 'b',
        eventType: 'oil_shock',
        singleAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -800, high: 200 },
          holdingDirections: new Map(),
          reasoning: 'test',
          judgeScore: score2,
        },
      }),
    ]
    const avg = computeAverageJudgeScore(results, 'singleAgent')
    expect(avg).toBeDefined()
    expect(avg!.causalReasoning).toBe(3) // (4 + 2) / 2
    expect(avg!.riskIdentification).toBe(4) // (3 + 5) / 2
    expect(avg!.transparency).toBe(3) // (2 + 4) / 2
  })
})
