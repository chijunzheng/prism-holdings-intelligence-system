# Feature: Researcher Debate

**ID:** 09
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 08 (Analyst Team)
**Tier:** 3

## Description

Bull vs Bear researcher debate inspired by TradingAgents. Takes 4 raw analyst assessments and refines through structured adversarial debate (2-3 rounds). Produces DebateResolution with refined holding impacts, concessions, and unresolved disagreements.

## Acceptance Criteria

- [ ] Bull Researcher synthesizes analyst consensus into coherent thesis
- [ ] Bear Researcher challenges with counter-evidence via Gemini Search
- [ ] Debate runs 2-3 rounds with structured arguments
- [ ] Early exit when both agree on direction (even if magnitude differs)
- [ ] DebateResolution captures: concessions, disagreements, refined impacts
- [ ] Each round introduces NEW evidence (Bear can't repeat prior points)
- [ ] Convergence detection: `Bull.concessions ∩ Bear.concessions` covers disagreements
- [ ] Tests verify debate produces valid DebateResolution

## Files to Create

- `agents/src/multi-agent/researchers/bull-researcher.ts`
- `agents/src/multi-agent/researchers/bear-researcher.ts`
- `agents/src/multi-agent/researchers/debate-protocol.ts`
- `agents/src/multi-agent/researchers/__tests__/debate.test.ts`

## Implementation Details

### Bull Researcher

**Task:** Build the strongest case FOR the analyst consensus.

Round 1: Synthesizes all 4 analyst views into a coherent thesis. Identifies strongest evidence and most agreed-upon transmission channels.

Subsequent rounds: Responds to Bear's counterarguments. Must address each point with evidence.

```typescript
async function runBullResearcher(params: {
  analystAssessments: AnalystAssessment[]
  signal: Signal
  exposureMap: ExposureMap
  bearArgument?: DebateArgument  // From previous round
  ownPriorArgument?: DebateArgument
}): Promise<DebateArgument>
```

### Bear Researcher

**Task:** Challenge the consensus. Find flaws, missing risks, over-confidence, historical counterexamples.

Round 1: Identifies weakest assumptions across all analysts. Finds counter-evidence. Argues for smaller/different impact.

Subsequent rounds: Rebuts Bull's defense. MUST introduce NEW evidence, not repeat.

```typescript
async function runBearResearcher(params: {
  analystAssessments: AnalystAssessment[]
  bullArgument: DebateArgument
  signal: Signal
  ownPriorArgument?: DebateArgument
}): Promise<DebateArgument>
```

### Debate Protocol (Loop Logic)

```typescript
type DebateState = {
  round: number
  bullArguments: DebateArgument[]
  bearArguments: DebateArgument[]
  maxRounds: 3
}

function shouldContinueDebate(state: DebateState): boolean {
  if (state.round >= state.maxRounds) return false

  // Early exit: direction agreement
  const bullDirection = state.bullArguments.at(-1)?.position
  const bearDirection = state.bearArguments.at(-1)?.position
  if (bullDirection === bearDirection) return false

  // Early exit: convergence (concessions cover major disagreements)
  if (hasConverged(state)) return false

  return true
}
```

### Debate Resolution Builder

```typescript
function buildDebateResolution(state: DebateState, analysts: AnalystAssessment[]): DebateResolution {
  // Extract concessions from each side's arguments
  const bullConcessions = extractConcessions(state.bullArguments)
  const bearConcessions = extractConcessions(state.bearArguments)

  // Compute refined holding impacts (weighted by debate outcome)
  const refinedImpacts = refineHoldingImpacts(analysts, bullConcessions, bearConcessions)

  // Compute consensus direction and magnitude
  const consensus = computeConsensus(state)

  return {
    signalId: signal.id,
    rounds: state.round,
    consensusDirection: consensus.direction,
    consensusMagnitude: consensus.magnitude,
    consensusConfidence: consensus.confidence,
    bullConcessions,
    bearConcessions,
    unresolvedDisagreements: findUnresolved(state),
    refinedHoldingImpacts: refinedImpacts,
    debateTranscript: [...state.bullArguments, ...state.bearArguments],
  }
}
```

### LangGraph Wiring

```typescript
// Conditional edges for debate loop
graph.addConditionalEdges("bear_researcher", (state) =>
  state.debateRound >= 3 || hasConverged(state)
    ? "resolve_debate"
    : "bull_researcher"
)
```

### Prompt Design

Bull prompt: "You are synthesizing 4 analyst perspectives into the strongest case for impact. Support your thesis with specific evidence from analysts."

Bear prompt: "You are challenging the consensus. Find the weakest assumptions. In each round after the first, you MUST introduce at least one piece of NEW evidence. Do not repeat prior arguments."

## Testing Requirements

- [ ] Debate produces DebateResolution with >=1 concession per side
- [ ] consensusDirection is set (not null)
- [ ] refinedHoldingImpacts are valid HoldingImpactEstimate[]
- [ ] Early exit: when analysts all agree on direction, debate ends in <=2 rounds
- [ ] Max rounds: debate stops after 3 rounds regardless
- [ ] Debate transcript contains all arguments from both sides

## Implementation Checklist

- [ ] Implement bull-researcher.ts with Gemini Search
- [ ] Implement bear-researcher.ts with Gemini Search
- [ ] Implement debate-protocol.ts (loop, convergence, resolution)
- [ ] Wire into LangGraph conditional edges
- [ ] Write tests with mock analyst assessments
- [ ] Export debate node functions
