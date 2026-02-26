import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  StrategyDraftSchema,
  StrategyEvaluationSchema,
  type StrategyDraft,
  type StrategyEvaluation,
} from '@prism/shared'
import { getFundComposition, getPortfolioByUserId, getUserProfileById } from '@prism/data'
import type { PipelineContext } from '@prism/agents/src/orchestrator/index'
import { runStrategyDraft, runStrategyEvaluation } from '@prism/agents/src/strategy/index'
import {
  createStrategyDraft,
  evaluateStrategy,
  parseStrategyDraftRequest,
  parseStrategyEvaluateRequest,
} from '../strategy-service'

vi.mock('@prism/agents/src/strategy/index', () => ({
  runStrategyDraft: vi.fn(),
  runStrategyEvaluation: vi.fn(),
}))

const MOCK_DRAFT: StrategyDraft = {
  signalId: 'sig-01',
  signalHeadline: 'BoC Holds Rate at 2.25%',
  generatedAt: '2026-02-26T10:00:00.000Z',
  objective: 'minimize_one_month_downside_with_six_month_guardrail',
  constraints: {
    turnoverCapPct: 5,
    hardMaxTurnoverPct: 10,
    allowCashBuffer: true,
    taxAware: true,
    noMicrocaps: true,
    excludeLeveragedEtfs: true,
    maxNewPositions: 2,
  },
  candidates: [
    {
      id: 'cand-zag',
      ticker: 'ZAG',
      name: 'BMO Aggregate Bond Index ETF',
      type: 'etf',
      rationale: 'Defensive fixed-income sleeve to offset downside in risk assets.',
      confidence: 0.78,
      expectedMitigationCad: 190,
      proposedShiftPct: 1.5,
      diversificationScore: 0.84,
      estimatedTurnoverCostCad: 15,
      estimatedTaxCostCad: 11,
      isLargeCapProxy: false,
      liquidityTier: 'high',
      rankScore: 101.4,
    },
  ],
  scenario: {
    items: [
      {
        candidateId: 'cand-zag',
        ticker: 'ZAG',
        name: 'BMO Aggregate Bond Index ETF',
        type: 'etf',
        rationale: 'Defensive fixed-income sleeve to offset downside in risk assets.',
        confidence: 0.78,
        expectedMitigationCad: 190,
        diversificationScore: 0.84,
        estimatedTurnoverCostCad: 15,
        estimatedTaxCostCad: 11,
        allocationPct: 1.5,
      },
    ],
  },
  baselineOneMonthCad: -1250,
  baselineSixMonthCad: -640,
  seedSummary: 'Build mitigation plan for current signal',
  humanDecisionRequired: true,
}

const MOCK_EVALUATION: StrategyEvaluation = {
  generatedAt: '2026-02-26T10:01:00.000Z',
  objective: 'minimize_one_month_downside_with_six_month_guardrail',
  baselineOneMonthCad: -1250,
  proposedOneMonthCad: -830,
  baselineSixMonthCad: -640,
  proposedSixMonthCad: -450,
  downsideReductionCad: 420,
  sixMonthGuardrailDeltaCad: 190,
  diversificationGain: 1.42,
  turnoverPct: 2.2,
  turnoverCapPct: 5,
  taxPenaltyCad: 21,
  score: 174.8,
  objectiveSatisfied: true,
  warnings: [],
  humanDecisionRequired: true,
}

const mockRunStrategyDraft = vi.mocked(runStrategyDraft)
const mockRunStrategyEvaluation = vi.mocked(runStrategyEvaluation)

function buildCtx(): PipelineContext {
  const portfolio = getPortfolioByUserId('sarah-01')
  const profile = getUserProfileById('sarah-01')
  if (!portfolio || !profile) {
    throw new Error('Test fixture profile/portfolio not found')
  }

  return {
    portfolio,
    profile,
    getFundComposition,
  }
}

describe('strategy-service contracts', () => {
  beforeEach(() => {
    mockRunStrategyDraft.mockReset()
    mockRunStrategyEvaluation.mockReset()
  })

  it('parses valid draft requests and rejects invalid payloads', () => {
    const valid = parseStrategyDraftRequest({
      signalId: 'sig-01',
      seedSummary: 'Build mitigation plan',
      maxCandidates: 5,
    })
    expect(valid.ok).toBe(true)

    const invalid = parseStrategyDraftRequest({
      maxCandidates: 25,
    })
    expect(invalid.ok).toBe(false)
  })

  it('parses valid evaluate requests and rejects invalid payloads', () => {
    const valid = parseStrategyEvaluateRequest({
      signalId: 'sig-01',
      scenario: MOCK_DRAFT.scenario,
      explicitOverride: false,
    })
    expect(valid.ok).toBe(true)

    const invalid = parseStrategyEvaluateRequest({
      signalId: 'sig-01',
      explicitOverride: false,
    })
    expect(invalid.ok).toBe(false)
  })

  it('returns StrategyDraft contract from createStrategyDraft', async () => {
    mockRunStrategyDraft.mockResolvedValue({
      success: true,
      data: MOCK_DRAFT,
      durationMs: 8,
    })

    const ctx = buildCtx()
    const request = {
      signalId: 'sig-01',
      seedSummary: 'Build mitigation plan for this signal',
      maxCandidates: 5,
      explicitOverride: false,
    }

    const result = await createStrategyDraft(ctx, request)

    expect(result.success).toBe(true)
    expect(mockRunStrategyDraft).toHaveBeenCalledTimes(1)
    expect(mockRunStrategyDraft).toHaveBeenCalledWith(ctx, request)
    expect(() => StrategyDraftSchema.parse(result.data)).not.toThrow()
  })

  it('returns StrategyEvaluation contract from evaluateStrategy', async () => {
    mockRunStrategyEvaluation.mockResolvedValue({
      success: true,
      data: MOCK_EVALUATION,
      durationMs: 7,
    })

    const ctx = buildCtx()
    const request = {
      signalId: 'sig-01',
      scenario: MOCK_DRAFT.scenario,
      explicitOverride: false,
    }

    const result = await evaluateStrategy(ctx, request)

    expect(result.success).toBe(true)
    expect(mockRunStrategyEvaluation).toHaveBeenCalledTimes(1)
    expect(mockRunStrategyEvaluation).toHaveBeenCalledWith(ctx, request)
    expect(() => StrategyEvaluationSchema.parse(result.data)).not.toThrow()
  })
})
