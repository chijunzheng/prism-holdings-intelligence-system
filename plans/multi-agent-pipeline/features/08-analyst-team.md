# Feature: Analyst Team

**ID:** 08
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 04 (Market Data Service)
**Tier:** 2

## Description

4 parallel analyst agents, each with a different analysis mandate. Each receives the same signal + ExposureMap + portfolio but produces a focused assessment from their specialty. Uses Gemini Flash with Search grounding for real evidence.

## Acceptance Criteria

- [ ] 4 analysts implemented: Macro, Fundamental, Sentiment, Technical
- [ ] Each produces Zod-valid `AnalystAssessment`
- [ ] Each has >=2 `keyAssumptions` and >=1 `evidenceSource`
- [ ] Technical Analyst uses real volatility data from Market Data Service
- [ ] All 4 run concurrently via LangGraph `Send()` fan-out
- [ ] Shared prompt builder constructs common context for all analysts
- [ ] Tests verify valid output structure for sample signals

## Files to Create

- `agents/src/multi-agent/analysts/shared-prompt.ts` - Common context builder
- `agents/src/multi-agent/analysts/macro-analyst.ts`
- `agents/src/multi-agent/analysts/fundamental-analyst.ts`
- `agents/src/multi-agent/analysts/sentiment-analyst.ts`
- `agents/src/multi-agent/analysts/technical-analyst.ts`
- `agents/src/multi-agent/analysts/__tests__/analysts.test.ts`

## Implementation Details

### Shared Prompt Builder

Constructs the common context section for all analysts:
- Signal details (event, source, urgency)
- Portfolio holdings (ticker, value, allocation %)
- Exposure map (sector concentrations, overlaps)
- Risk profile summary
- Market data bundle (volatility, correlations — for Technical Analyst)

### Analyst Mandates

| Agent | Mandate | Grounding Focus | Output Focus |
|-------|---------|----------------|--------------|
| Macro | Monetary policy, fiscal, trade flows, currency, sovereign risk | Central bank data, trade policy, GDP | Sector-level directional + magnitude |
| Fundamental | Earnings, valuation, business model impact via look-through | Earnings data, analyst consensus, P/E | Holding-level earnings/valuation |
| Sentiment | Market sentiment, momentum, positioning, is-it-priced-in | Market sentiment, retail vs institutional flow | Sentiment indicators + momentum |
| Technical | Support/resistance, trend, historical vol, price ranges | Price levels, historical returns, sector vol | Price targets + range estimates per horizon |

### Each Analyst Output

```typescript
type AnalystAssessment = {
  analystType: 'macro' | 'fundamental' | 'sentiment' | 'technical'
  overallDirection: 'positive' | 'negative' | 'neutral' | 'mixed'
  overallConfidence: number  // 0-1
  holdingImpacts: HoldingImpactEstimate[]
  keyAssumptions: string[]   // 2-3 explicit assumptions (required for risk team)
  evidenceSources: string[]  // From Gemini Search (required for grounding)
  reasoning: string          // Plain English narrative
}
```

### LLM Configuration

```typescript
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0.3,  // Low temp for analytical consistency
})
// Enable Google Search grounding for real evidence
```

### Prompt Structure (per analyst)

```
You are a {type} analyst. Your SPECIFIC mandate is: {mandate}

SIGNAL: {signal details}
PORTFOLIO: {holdings with values and allocations}
EXPOSURE: {sector concentrations}
{For Technical: MARKET DATA: {real volatility, price levels}}

Analyze this signal's impact on the portfolio from your specific perspective.

Requirements:
1. Provide overallDirection and overallConfidence (0-1)
2. For each affected holding, estimate: direction, magnitude (0-1 qualitative), confidence
3. State 2-3 KEY ASSUMPTIONS your analysis depends on
4. Cite evidence sources from your search
5. Do NOT estimate dollar amounts — only qualitative magnitude (0-1)

Output as JSON matching the AnalystAssessment schema.
```

### LangGraph Fan-Out

```typescript
// In orchestrator, dispatch_analysts node:
function dispatchAnalysts(state: PipelineState) {
  return ['macro', 'fundamental', 'sentiment', 'technical'].map(
    type => new Send('analyst', { ...state, analystType: type })
  )
}
```

## Testing Requirements

- [ ] Each analyst returns valid AnalystAssessment
- [ ] keyAssumptions has >=2 entries
- [ ] evidenceSources has >=1 entry
- [ ] holdingImpacts covers affected holdings (not necessarily all)
- [ ] Direction is one of: positive/negative/neutral/mixed
- [ ] Confidence is between 0 and 1
- [ ] Fan-out produces exactly 4 results

## Implementation Checklist

- [ ] Implement shared-prompt.ts context builder
- [ ] Implement macro-analyst.ts with Gemini Search
- [ ] Implement fundamental-analyst.ts with Gemini Search
- [ ] Implement sentiment-analyst.ts with Gemini Search
- [ ] Implement technical-analyst.ts with real market data
- [ ] Wire LangGraph Send() fan-out node
- [ ] Write tests with sample signal
- [ ] Export analyst node function
