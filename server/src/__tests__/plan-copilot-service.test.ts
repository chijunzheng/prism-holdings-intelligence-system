import { describe, expect, it } from 'vitest'
import type { PlanSelection, StrategyCandidate } from '@prism/shared'
import {
  buildPlanCopilotProposalResponse,
  parsePlanCopilotRequest,
} from '../plan-copilot-service'

const CANDIDATES: ReadonlyArray<StrategyCandidate> = [
  {
    id: 'cand-abx',
    ticker: 'ABX',
    name: 'Barrick Gold Corp.',
    type: 'stock',
    rationale: 'Large-cap gold miner proxy from XEG constituents.',
    confidence: 0.74,
    expectedMitigationCad: 156,
    proposedShiftPct: 1.2,
    diversificationScore: 0.81,
    estimatedTurnoverCostCad: 18,
    estimatedTaxCostCad: 12,
    isLargeCapProxy: true,
    liquidityTier: 'high',
    rankScore: 124.1,
  },
  {
    id: 'cand-cnq',
    ticker: 'CNQ',
    name: 'Canadian Natural Resources',
    type: 'stock',
    rationale: 'Energy hedge candidate.',
    confidence: 0.68,
    expectedMitigationCad: 197,
    proposedShiftPct: 1.0,
    diversificationScore: 0.64,
    estimatedTurnoverCostCad: 22,
    estimatedTaxCostCad: 20,
    isLargeCapProxy: true,
    liquidityTier: 'high',
    rankScore: 108.3,
  },
  {
    id: 'cand-nem',
    ticker: 'NEM',
    name: 'Newmont Corporation',
    type: 'stock',
    rationale: 'Defensive metal exposure with diversification lift.',
    confidence: 0.72,
    expectedMitigationCad: 179,
    proposedShiftPct: 1.4,
    diversificationScore: 0.86,
    estimatedTurnoverCostCad: 19,
    estimatedTaxCostCad: 14,
    isLargeCapProxy: true,
    liquidityTier: 'high',
    rankScore: 131.8,
  },
]

const SELECTIONS: ReadonlyArray<PlanSelection> = [
  {
    candidateId: 'cand-cnq',
    ticker: 'CNQ',
    name: 'Canadian Natural Resources',
    allocationPct: 1.0,
  },
]

describe('plan-copilot-service', () => {
  it('rejects malformed copilot payloads', () => {
    const result = parsePlanCopilotRequest({ history: [] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('message is required')
  })

  it('parses and sanitizes valid copilot payloads', () => {
    const result = parsePlanCopilotRequest({
      signalId: 'sig-1',
      message: ' Replace CNQ with NEM at 2.0% ',
      currentSelections: SELECTIONS,
      candidateUniverse: CANDIDATES,
      history: [{ role: 'user', content: 'Prior turn' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.message).toBe('Replace CNQ with NEM at 2.0%')
    expect(result.data.currentSelections).toHaveLength(1)
    expect(result.data.candidateUniverse).toHaveLength(3)
  })

  it('builds replace/add proposal actions for alternative-style prompts', () => {
    const response = buildPlanCopilotProposalResponse({
      message: 'Can you replace CNQ with a better alternative like NEM at 2%?',
      assistantText: '',
      currentSelections: SELECTIONS,
      candidateUniverse: CANDIDATES,
      signalHeadline: 'Canadian Banks Report Strong Q1 Earnings',
      signalOneMonthImpactCad: -1600,
      topExposureLabel: 'Canadian Financials (22.3%)',
      warningCount: 3,
    })

    expect(response.proposal).not.toBeNull()
    const actions = response.proposal?.actions ?? []
    expect(actions.some((action) => action.type === 'remove_candidate' && action.ticker === 'CNQ')).toBe(true)
    expect(actions.some((action) => action.type === 'add_candidate' && action.ticker === 'NEM')).toBe(true)
    expect(response.followUps.length).toBeGreaterThan(0)
    expect(response.assistantText.length).toBeGreaterThan(0)
  })

  it('falls back to grounded assistant summary when upstream assistant text is unavailable', () => {
    const response = buildPlanCopilotProposalResponse({
      message: 'What should I do next?',
      assistantText: 'Error: Gemini API key not configured.',
      currentSelections: [],
      candidateUniverse: CANDIDATES,
      signalHeadline: 'Commodity Shock',
      signalOneMonthImpactCad: -900,
      topExposureLabel: 'US Technology (16.5%)',
      warningCount: 2,
    })

    expect(response.assistantText).toContain('Commodity Shock')
    expect(response.assistantText).toContain('US Technology (16.5%)')
  })
})
