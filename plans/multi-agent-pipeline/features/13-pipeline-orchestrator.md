# Feature: Pipeline Orchestrator

**ID:** 13
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 12 (Judge Agent)
**Tier:** 5

## Description

LangGraph StateGraph that wires all agents together into the complete multi-agent pipeline. Includes typed state with reducers, fan-out for analysts, conditional edges for debate and judge loops, and interrupt_before for human checkpoints.

## Acceptance Criteria

- [ ] Complete StateGraph compiled with all nodes and edges
- [ ] 4 analysts fan out via Send() and fan back in
- [ ] Debate loop with conditional edges and max rounds
- [ ] Risk team runs sequentially
- [ ] Fund Manager ↔ Judge loop with convergence check
- [ ] `interrupt_before` at Checkpoint 1 (after debate) and Checkpoint 2 (after stress test)
- [ ] Human inputs (correction, scenario preference) injected after interrupts
- [ ] Pipeline state is fully typed with PipelineState Annotation
- [ ] `runMultiAgentAnalysis()` is the public API
- [ ] End-to-end test: signal → FundManagerVerdict + ResearchBrief
- [ ] Completes in <20s for a single signal

## Files to Create/Modify

- `agents/src/multi-agent/state.ts` - PipelineState Annotation
- `agents/src/multi-agent/orchestrator.ts` - LangGraph StateGraph
- `agents/src/multi-agent/index.ts` - Public API
- `agents/src/multi-agent/__tests__/orchestrator.test.ts`

## Implementation Details

### PipelineState (state.ts)

```typescript
import { Annotation } from "@langchain/langgraph"

export const PipelineState = Annotation.Root({
  // Inputs
  signal: Annotation<Signal>,
  exposureMap: Annotation<ExposureMap>,
  portfolio: Annotation<Portfolio>,
  userProfile: Annotation<UserProfile>,
  marketData: Annotation<MarketDataBundle>,

  // Stage 0 output
  riskProfile: Annotation<InferredRiskProfile>,

  // Stage 1 output (analyst fan-out — array reducer)
  analystAssessments: Annotation<AnalystAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Stage 2 (debate)
  debateRound: Annotation<number>({ default: () => 0 }),
  bullArguments: Annotation<DebateArgument[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  bearArguments: Annotation<DebateArgument[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  debateResolution: Annotation<DebateResolution | null>({ default: () => null }),

  // Human inputs
  humanCorrectionAtDebate: Annotation<string | null>({ default: () => null }),
  humanScenarioPreference: Annotation<'base' | 'downside' | 'tail' | null>({ default: () => null }),

  // Stage 3 outputs (risk team)
  riskChallenge: Annotation<RiskChallenge | null>({ default: () => null }),
  magnitudeValidation: Annotation<MagnitudeValidation | null>({ default: () => null }),
  stressTest: Annotation<StressTestResult | null>({ default: () => null }),

  // Stage 4 outputs
  fundManagerVerdict: Annotation<FundManagerVerdict | null>({ default: () => null }),
  judgeVerdict: Annotation<JudgeVerdict | null>({ default: () => null }),
  synthesisRound: Annotation<number>({ default: () => 0 }),

  // Final output
  researchBrief: Annotation<ResearchBrief | null>({ default: () => null }),
})
```

### StateGraph (orchestrator.ts)

```typescript
const graph = new StateGraph(PipelineState)
  .addNode("infer_risk_profile", inferRiskProfileNode)
  .addNode("fetch_market_data", fetchMarketDataNode)
  .addNode("dispatch_analysts", dispatchAnalystsNode)
  .addNode("analyst", analystNode)
  .addNode("bull_researcher", bullResearcherNode)
  .addNode("bear_researcher", bearResearcherNode)
  .addNode("resolve_debate", resolveDebateNode)
  .addNode("assumptions_challenger", assumptionsChallengerNode)
  .addNode("magnitude_validator", magnitudeValidatorNode)
  .addNode("portfolio_stress", portfolioStressNode)
  .addNode("fund_manager", fundManagerNode)
  .addNode("judge", judgeNode)
  .addNode("generate_brief", generateBriefNode)

  // Edges
  .addEdge("__start__", "infer_risk_profile")
  .addEdge("infer_risk_profile", "fetch_market_data")
  .addEdge("fetch_market_data", "dispatch_analysts")
  .addEdge("dispatch_analysts", "analyst")  // Send() fan-out
  .addEdge("analyst", "bull_researcher")    // fan-in: waits for all 4
  .addEdge("bull_researcher", "bear_researcher")
  .addConditionalEdges("bear_researcher", debateContinueCheck)
  .addEdge("resolve_debate", "assumptions_challenger")
  .addEdge("assumptions_challenger", "magnitude_validator")
  .addEdge("magnitude_validator", "portfolio_stress")
  .addEdge("portfolio_stress", "fund_manager")
  .addEdge("fund_manager", "judge")
  .addConditionalEdges("judge", judgeContinueCheck)
  .addEdge("judge", "generate_brief")  // On convergence

  .compile({
    interruptBefore: ["assumptions_challenger", "fund_manager"],
    checkpointer: new MemorySaver(),
  })
```

### Public API (index.ts)

```typescript
export async function runMultiAgentAnalysis(params: {
  signal: Signal
  portfolio: Portfolio
  userProfile: UserProfile
  exposureMap: ExposureMap
  skipCheckpoints?: boolean  // For eval harness
  onProgress?: (stage: string, data: unknown) => void
}): Promise<{
  verdict: FundManagerVerdict
  researchBrief: ResearchBrief
  intermediateArtifacts: {
    riskProfile: InferredRiskProfile
    analystAssessments: AnalystAssessment[]
    debateResolution: DebateResolution
    riskChallenge: RiskChallenge
    magnitudeValidation: MagnitudeValidation
    stressTest: StressTestResult
    judgeVerdict: JudgeVerdict
  }
}>
```

### Checkpoint Handling

Checkpoints pause the graph and return state to the caller. The caller (server API) sends state to frontend for human input, then resumes:

```typescript
// Resume after Checkpoint 1:
await graph.invoke(null, {
  configurable: { thread_id: threadId },
  input: { humanCorrectionAtDebate: userInput },
})

// Resume after Checkpoint 2:
await graph.invoke(null, {
  configurable: { thread_id: threadId },
  input: { humanScenarioPreference: userChoice },
})
```

## Testing Requirements

- [ ] Full pipeline: signal → FundManagerVerdict (with skipCheckpoints: true)
- [ ] Exactly 4 analyst assessments produced
- [ ] Debate resolution has consensusDirection set
- [ ] Risk challenge has recommendations
- [ ] Stress test has VaR/CVaR values
- [ ] Judge converges (quality >= 0.65) within 2 iterations
- [ ] Research brief has all 10 sections
- [ ] Pipeline completes in <20s

## Implementation Checklist

- [ ] Implement PipelineState in state.ts
- [ ] Implement all node wrapper functions
- [ ] Wire StateGraph in orchestrator.ts
- [ ] Implement interrupt handling
- [ ] Implement runMultiAgentAnalysis() public API
- [ ] Wire progress callbacks
- [ ] Write integration tests
- [ ] Export from index.ts
