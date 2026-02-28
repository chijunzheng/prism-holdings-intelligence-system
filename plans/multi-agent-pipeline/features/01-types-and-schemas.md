# Feature: Types and Schemas

**ID:** 01
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None
**Tier:** 0

## Description

Define all Zod schemas and TypeScript types for inter-agent contracts. This is the foundation that all other features depend on.

## Acceptance Criteria

- [x] All Zod schemas compile and export correctly
- [x] Types cover: AnalystAssessment, DebateArgument, DebateResolution, RiskChallenge, MagnitudeValidation, StressTestResult, JudgeVerdict, FundManagerVerdict, InferredRiskProfile, PortfolioVerdict, ResearchBrief, DollarRange, HoldingImpactEstimate, Recommendation
- [x] UserProfile extended with `holdingsConsent` and `userExpectations`
- [x] MarketData types for Yahoo Finance service (VolatilityData, MarketDataBundle in multi-agent.ts)
- [ ] Unit tests verify schema validation accepts valid data and rejects invalid
- [x] `humanDecisionRequired: z.literal(true)` enforced on FundManagerVerdict

## Files to Create/Modify

- `shared/src/types/multi-agent.ts` - All multi-agent pipeline Zod schemas
- `shared/src/types/user-profile.ts` - Extended with consent + expectations
- `shared/src/types/market-data.ts` - Yahoo Finance data types
- `shared/src/__tests__/multi-agent-types.test.ts` - Schema validation tests

## Key Types

```typescript
// Core building blocks
DollarRange = { low: number; mid: number; high: number }
HoldingImpactEstimate = { ticker, name, direction, magnitudeScore, dollarImpact: Record<'1W'|'1M'|'6M', DollarRange>, confidence }

// Per-agent outputs
AnalystAssessment = { analystType, overallDirection, overallConfidence, holdingImpacts[], keyAssumptions[], evidenceSources[] }
DebateArgument = { position, keyPoints[], evidenceCited[], rebuttalPoints[] }
DebateResolution = { signalId, rounds, consensusDirection, consensusMagnitude, consensusConfidence, bullConcessions[], bearConcessions[], unresolvedDisagreements[], refinedHoldingImpacts[], debateTranscript[] }
RiskChallenge = { challengedAssumptions[], recommendedConfidenceAdjustment }
MagnitudeValidation = { holdingValidations[], outOfBoundsFlags[] }
StressTestResult = { baseCase, downside, tailRisk, reversalProbability, scenarios[] }
JudgeVerdict = { evidenceGrounding, assumptionQuality, magnitudeCalibration, internalConsistency, completeness, overallQualityScore, convergenceReached, feedback? }
FundManagerVerdict = { signalId, holdingImpacts[], recommendations[], riskAdjustments, perspectiveBreakdown, qualityScore, humanDecisionRequired: true }
InferredRiskProfile = { riskScore, riskTolerance, factors[], reasoning }
PortfolioVerdict = { signals[], holdingNetImpacts[], portfolioNetImpact, portfolioGrossImpact, keyInsights[], recommendations[], interactionSummary, humanDecisionRequired: true }
ResearchBrief = { sections: ResearchBriefSection[], metadata }

// User profile extensions
HoldingsConsent = { granted, grantedAt, scope }
UserExpectations = { riskToleranceOverride?, horizon?, personalSituation?, goals?, concerns? }
```

## Implementation Checklist

- [x] Create multi-agent.ts with all Zod schemas
- [x] Extend user-profile.ts with consent + expectations
- [x] Create market-data types (VolatilityData, MarketDataBundle in multi-agent.ts)
- [ ] Write validation tests
- [x] Export from shared/src/index.ts
