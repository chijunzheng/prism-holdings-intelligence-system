# Feature: Research Brief Template

**ID:** 06
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 01 (Types and Schemas)
**Tier:** 1

## Description

Pure template formatting engine that assembles all pipeline artifacts into a structured, auditable research brief. No LLM calls — just formatting computed data and agent outputs into a readable document. This is the system's equivalent of a sell-side research report.

## Acceptance Criteria

- [ ] Generates all 10 sections of the research brief from pipeline artifacts
- [ ] No LLM calls — pure template formatting
- [ ] All sources from pipeline are cited
- [ ] Computational derivation section shows real volatility, correlation, and calibration formula
- [ ] Monte Carlo results included with VaR/CVaR
- [ ] Quality score and judge assessment included
- [ ] Produces both full text and structured `ResearchBrief` object
- [ ] Unit tests verify all sections are populated from mock pipeline data

## Files to Create

- `agents/src/multi-agent/research-brief.ts`
- `agents/src/multi-agent/__tests__/research-brief.test.ts`

## Implementation Details

### Function Signature

```typescript
function generateResearchBrief(params: {
  signal: Signal
  analystAssessments: AnalystAssessment[]
  debateResolution: DebateResolution
  riskChallenge: RiskChallenge
  magnitudeValidation: MagnitudeValidation
  stressTest: StressTestResult
  verdict: FundManagerVerdict
  judgeVerdict: JudgeVerdict
  marketData: MarketDataBundle
  humanInputs: { correctionAtDebate?: string; scenarioPreference?: string }
}): ResearchBrief
```

### 10 Sections

1. **Signal Summary** — What, source, why it matters
2. **Analyst Perspectives** — 4-column table (analyst, direction, confidence, key finding)
3. **Debate Summary** — Bull thesis, bear thesis, concessions, refined estimate
4. **Risk Assessment** — Challenged assumptions, confidence haircut, historical bounds check
5. **Computational Derivation** — Real volatility, correlation matrix, calibration formula per holding
6. **Stress Scenarios** — Monte Carlo VaR/CVaR table
7. **Calibrated Impact** — Per-holding impact range table with derivation
8. **Recommendations** — Options with do-nothing baseline
9. **Quality Assessment** — 5-dimension judge scores
10. **Sources** — All cited evidence

### Output Structure

```typescript
type ResearchBrief = {
  signalId: string
  generatedAt: string
  qualityScore: number
  sections: {
    signalSummary: string
    analystPerspectives: { analyst: string; direction: string; confidence: number; keyFinding: string }[]
    debateSummary: { bullThesis: string; bearThesis: string; bullConcessions: string[]; bearConcessions: string[]; refinedEstimate: DollarRange }
    riskAssessment: { challengedAssumptions: number; keyChallenge: string; confidenceHaircut: number; boundsCheck: string[] }
    computationalDerivation: { tickers: { ticker: string; vol30d: number; annVol: number; eventMu: number | null; correlationWithPrimary: number }[] }
    stressScenarios: { baseCase: DollarRange; downside: DollarRange; tailRisk: DollarRange; reversalProbability: number }
    calibratedImpact: { holdings: { ticker: string; value: number; impactRange: DollarRange; derivation: string }[]; total: DollarRange }
    recommendations: { option: string; description: string; cost: string; reducesTo: string }[]
    qualityAssessment: JudgeVerdict
    sources: { index: number; description: string; url?: string }[]
  }
  fullText: string  // Formatted plain text version for display
  disclaimer: string
}
```

## Testing Requirements

- [ ] Mock all pipeline artifacts → generates brief with all 10 sections
- [ ] Missing optional fields (no human input, no event impact history) → graceful defaults
- [ ] fullText output is well-formatted with section headers
- [ ] Sources from all analysts are deduplicated and indexed

## Implementation Checklist

- [ ] Create template formatting functions per section
- [ ] Implement main `generateResearchBrief()` function
- [ ] Implement `formatFullText()` for plain text rendering
- [ ] Write unit tests with mock pipeline data
- [ ] Export from multi-agent/index.ts
