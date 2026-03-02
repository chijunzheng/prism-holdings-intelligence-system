import { describe, it, expect } from 'vitest'
import { generateResearchBrief } from '../research-brief'
import type {
  Signal,
  FundManagerVerdict,
  DebateResolution,
  RiskChallenge,
  StressTestResult,
  JudgeVerdict,
} from '@prism/shared'

const mockSignal: Signal = {
  id: 'sig-test-1',
  headline: 'Bank of Canada raises rates by 25bps',
  description: 'BOC raised overnight rate to 5.25%',
  affectedExposures: ['Canadian Financials', 'Fixed Income'],
  relevanceScore: 0.85,
  urgency: 'high',
  sentiment: 'negative',
  temporalClassification: 'structural',
  sources: [
    { title: 'Reuters', url: 'https://reuters.com/boc-rate' },
    { title: 'Globe and Mail', url: 'https://globeandmail.com/rates' },
  ],
  detectedAt: '2025-01-15T14:00:00Z',
  acknowledged: false,
}

const mockVerdict: FundManagerVerdict = {
  signalId: 'sig-test-1',
  holdingImpacts: [
    {
      ticker: 'RY',
      name: 'Royal Bank',
      holdingValueCad: 5000,
      direction: -0.6,
      impact: {
        '1W': { low: -30, mid: -50, high: -80 },
        '1M': { low: -100, mid: -200, high: -350 },
        '6M': { low: -200, mid: -500, high: -800 },
      },
      confidence: 0.7,
      derivation: '$5,000 × 60% magnitude × -0.60 direction. Vol: 4.2% monthly (Yahoo Finance). Haircut: -15%.',
    },
    {
      ticker: 'ZAG',
      name: 'BMO Aggregate Bond',
      holdingValueCad: 3000,
      direction: -0.4,
      impact: {
        '1M': { low: -30, mid: -60, high: -100 },
      },
      confidence: 0.65,
      derivation: '$3,000 × 40% magnitude × -0.40 direction. Vol: 2.0% monthly (fallback). Haircut: -15%.',
    },
  ],
  recommendations: [
    { id: 'do-nothing', title: 'Do nothing', description: 'Accept risk.', estimatedCost: '$0', riskReduction: 'None', tradeoffs: ['No cost', 'Full exposure'], isDoNothing: true },
    { id: 'light', title: 'Light protection', description: 'Reduce bank exposure.', estimatedCost: '$200', riskReduction: '$80 reduction', tradeoffs: ['Lower cost'], isDoNothing: false },
  ],
  riskAdjustments: {
    confidenceHaircut: -0.15,
    magnitudeBoundsApplied: ['RY: clamped from 80.0% to 60.0%'],
    scenarioPreference: 'base',
  },
  perspectiveBreakdown: {
    bullCase: 'Canadian banks have strong capital buffers.',
    bearCase: 'Rate sensitivity could compress NIM.',
    unresolvedDisagreements: ['Magnitude of NIM compression'],
  },
  qualityScore: 0.72,
  humanDecisionRequired: true,
}

const mockDebate: DebateResolution = {
  signalId: 'sig-test-1',
  rounds: 2,
  consensusDirection: 'negative',
  consensusMagnitude: 0.55,
  consensusConfidence: 0.70,
  bullConcessions: ['Impact may be smaller for diversified banks'],
  bearConcessions: ['Forward guidance risk is real'],
  unresolvedDisagreements: ['Magnitude of NIM compression'],
  refinedHoldingImpacts: [],
  debateTranscript: [
    {
      position: 'negative',
      round: 1,
      keyPoints: ['Rate hike will compress NIM'],
      evidenceCited: ['BOC statement January 2025'],
      rebuttalPoints: [],
      concessions: [],
    },
    {
      position: 'negative',
      round: 1,
      keyPoints: ['Banks have hedged rate exposure'],
      evidenceCited: ['RBC Q3 earnings call'],
      rebuttalPoints: ['NIM compression is real'],
      concessions: ['Forward guidance risk is real'],
    },
  ],
}

const mockRiskChallenge: RiskChallenge = {
  challengedAssumptions: [
    {
      analystType: 'macro',
      assumption: 'Rate hike will persist for 6+ months',
      counterEvidence: 'Market pricing suggests cuts by Q3',
      likelihoodOfBeingWrong: 0.3,
    },
  ],
  recommendedConfidenceAdjustment: -0.15,
  overallAssessment: 'Moderate confidence adjustment warranted.',
}

const mockStressTest: StressTestResult = {
  numSimulations: 10000,
  baseCase: { low: -150, mid: -260, high: -400 },
  downside: { low: -400, mid: -600, high: -900 },
  tailRisk: { low: -800, mid: -1200, high: -1800 },
  reversalProbability: 0.15,
  scenarios: [],
  holdingBreakdown: [
    { ticker: 'RY', baseImpact: -200, downsideImpact: -450, tailImpact: -900 },
    { ticker: 'ZAG', baseImpact: -60, downsideImpact: -150, tailImpact: -300 },
  ],
}

const mockJudge: JudgeVerdict = {
  evidenceGrounding: 0.8,
  assumptionQuality: 0.7,
  magnitudeCalibration: 0.75,
  internalConsistency: 0.8,
  completeness: 0.85,
  overallQualityScore: 0.78,
  convergenceReached: true,
}

describe('generateResearchBrief', () => {
  it('generates a brief with all 10 sections', () => {
    const brief = generateResearchBrief({
      signal: mockSignal,
      verdict: mockVerdict,
      debateResolution: mockDebate,
      riskChallenge: mockRiskChallenge,
      stressTest: mockStressTest,
      judgeVerdict: mockJudge,
    })

    expect(brief.sections).toHaveLength(11)
    expect(brief.sections.map((s) => s.title)).toEqual([
      'Signal Summary',
      'Causal Analysis',
      'Debate Summary',
      'Risk Assessment',
      'Stress Scenarios',
      'Calibrated Impact',
      'Risk Adjustments',
      'Perspective Breakdown',
      'Recommendations',
      'Quality Assessment',
      'Sources',
    ])
  })

  it('populates signalId and qualityScore', () => {
    const brief = generateResearchBrief({
      signal: mockSignal,
      verdict: mockVerdict,
      debateResolution: mockDebate,
      riskChallenge: mockRiskChallenge,
      stressTest: mockStressTest,
      judgeVerdict: mockJudge,
    })

    expect(brief.signalId).toBe('sig-test-1')
    expect(brief.qualityScore).toBe(0.78)
    expect(brief.generatedAt).toBeDefined()
  })

  it('computes aggregate impact range from verdict holdings', () => {
    const brief = generateResearchBrief({
      signal: mockSignal,
      verdict: mockVerdict,
      debateResolution: mockDebate,
      riskChallenge: mockRiskChallenge,
      stressTest: mockStressTest,
      judgeVerdict: mockJudge,
    })

    // RY 1M: -100/-200/-350 + ZAG 1M: -30/-60/-100
    expect(brief.impactRange.low).toBe(-130)
    expect(brief.impactRange.mid).toBe(-260)
    expect(brief.impactRange.high).toBe(-450)
  })

  it('includes disclaimer', () => {
    const brief = generateResearchBrief({
      signal: mockSignal,
      verdict: mockVerdict,
      debateResolution: mockDebate,
      riskChallenge: mockRiskChallenge,
      stressTest: mockStressTest,
      judgeVerdict: mockJudge,
    })

    expect(brief.disclaimer).toContain('informational purposes only')
    expect(brief.disclaimer).toContain('not constitute financial advice')
  })

  it('collects and deduplicates sources', () => {
    const brief = generateResearchBrief({
      signal: mockSignal,
      verdict: mockVerdict,
      debateResolution: mockDebate,
      riskChallenge: mockRiskChallenge,
      stressTest: mockStressTest,
      judgeVerdict: mockJudge,
    })

    // Debate has 2 evidence citations, risk has 1 counter-evidence
    expect(brief.sources.length).toBeGreaterThanOrEqual(2)
    expect(brief.sources[0].index).toBe(1)
  })

  it('generates fullText with section headers', () => {
    const brief = generateResearchBrief({
      signal: mockSignal,
      verdict: mockVerdict,
      debateResolution: mockDebate,
      riskChallenge: mockRiskChallenge,
      stressTest: mockStressTest,
      judgeVerdict: mockJudge,
    })

    expect(brief.fullText).toContain('## Signal Summary')
    expect(brief.fullText).toContain('## Debate Summary')
    expect(brief.fullText).toContain('## Quality Assessment')
    expect(brief.fullText).toContain('Bank of Canada raises rates')
  })
})
