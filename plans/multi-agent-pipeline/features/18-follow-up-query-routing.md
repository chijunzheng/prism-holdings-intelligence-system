# Feature: Follow-Up Query Routing

**ID:** 18
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 13 (Pipeline Orchestrator), 15 (Chat UI Layout)
**Tier:** 7

## Description

Classify follow-up queries and route them efficiently: drill-downs use cached artifacts (<2s), what-ifs partially re-run the pipeline (~8-12s), new signals trigger full pipeline.

## Acceptance Criteria

- [ ] Query classification: drill-down, what-if (assumption), what-if (portfolio), comparison, new signal
- [ ] Drill-down queries answered from cached artifacts in <2s
- [ ] What-if on assumption: re-runs from researcher stage, skips analysts
- [ ] What-if on portfolio: re-runs full pipeline with modified portfolio
- [ ] Cross-signal comparison: reads both cached verdicts
- [ ] Chat agent context: compressed FollowUpContext (~5-10K tokens)
- [ ] Conversation history: sliding window of last 10 messages

## Files to Create

- `agents/src/chat-agent/follow-up-router.ts` - Query classification + routing
- `agents/src/chat-agent/__tests__/follow-up-router.test.ts`

## Implementation Details

### Query Classification

```typescript
type FollowUpType = 'drill_down' | 'what_if_assumption' | 'what_if_portfolio' | 'comparison' | 'new_signal' | 'general'

async function classifyFollowUp(params: {
  message: string
  activeSignals: Signal[]
  cachedVerdicts: FundManagerVerdict[]
}): Promise<{
  type: FollowUpType
  modifiedAssumptions?: string[]
  modifiedPortfolio?: PortfolioDelta
  targetSignalId?: string
}>
```

### Routing Table

| Type | Re-analysis? | Strategy | Latency |
|------|-------------|----------|---------|
| drill_down | No | Read cached ResearchBrief + Verdict | ~1-2s |
| what_if_assumption | Partial | Re-run from Researcher stage | ~8-12s |
| what_if_portfolio | Full | Re-run with modified portfolio | ~15-20s |
| comparison | No | Read both cached Verdicts | ~1-2s |
| new_signal | Full | New pipeline execution | ~15-20s |
| general | No | Chat agent answers directly | ~1-2s |

### Follow-Up Context (for chat agent)

```typescript
type FollowUpContext = {
  signal: Signal                           // ~200 tokens
  portfolioSummary: PortfolioSummary       // ~300 tokens
  verdictSummary: VerdictSummary           // ~500 tokens
  userProfile: UserProfile                 // ~200 tokens
  researchBrief?: ResearchBrief            // ~3K tokens (on demand)
  debateResolution?: DebateResolution      // ~2K tokens (on demand)
  stressTestResult?: StressTestResult      // ~1K tokens (on demand)
  otherVerdicts?: VerdictSummary[]         // ~500 tokens each (for comparisons)
  recentMessages: ChatMessage[]            // Last 10, ~2K tokens
}
```

### What-If Partial Re-Run

```typescript
async function handleWhatIfAssumption(params: {
  modifiedAssumption: string
  existingCheckpoint: string  // LangGraph thread_id
}): Promise<FundManagerVerdict> {
  // Load checkpoint at debate stage
  // Inject modified assumption into Bull/Bear context
  // Re-run: Researchers → Risk Team → Fund Manager → Judge
  // Skip: Analysts (raw data unchanged for assumption changes)
}
```

## Testing Requirements

- [ ] "Tell me more about the bond impact" → classified as drill_down
- [ ] "What if 50bps instead of 25bps?" → classified as what_if_assumption
- [ ] "What if I sold ZAG?" → classified as what_if_portfolio
- [ ] "How does this compare to the oil signal?" → classified as comparison
- [ ] "What about the tariff announcement?" → classified as new_signal
- [ ] Drill-down response uses cached artifacts, not pipeline

## Implementation Checklist

- [ ] Implement query classification with Gemini Flash
- [ ] Implement routing logic per query type
- [ ] Implement cached artifact retrieval for drill-downs
- [ ] Implement what-if partial re-run via checkpoints
- [ ] Implement FollowUpContext builder
- [ ] Wire into chat endpoint
- [ ] Write tests for classification accuracy
