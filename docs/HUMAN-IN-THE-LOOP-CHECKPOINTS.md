# Human-In-The-Loop Checkpoints

**Status:** Production Ready
**Pattern:** LangGraph `interrupt()` with `interrupt_before` edges
**Modes:** Soft checkpoints (auto-continue after 60s) + Hard checkpoints (wait for human input)
**Key Innovation:** User can inject domain knowledge at strategic pipeline stages

## Overview

Prism implements **human-in-the-loop decision points** where users inject domain knowledge before critical analyses run. This is critical for financial decisions—the system doesn't know what the user knows (e.g., "competitor launching next month").

---

## Why Checkpoints Matter

### Without Checkpoints
- Pipeline runs end-to-end automatically
- Analysts debate with incomplete information
- User can't steer analysis before it happens
- Takes 6 seconds to discover a flaw in assumptions

### With Checkpoints
- User reviews debate outcome → can correct before risk team runs
- User chooses risk scenario (base/downside/tail) before recommendations generated
- Highest-value human input at points where it matters most
- Turns analysis into a **conversation, not a broadcast**

---

## Two Checkpoint Types

### Soft Checkpoints (Auto-Continue)
**Pattern:** User sees card with info, auto-continues after 60 seconds

Examples:
- Post-analyst review (before debate)
- Post-risk-challenge review (before magnitude validation)
- Post-verdict preview (before research brief generation)

**User Experience:**
```
1. Analysis runs
2. Soft checkpoint card appears
3. User has 60s to review/provide input
4. If no input → continues automatically
5. If input → pipeline uses it, continues
```

**Implementation:**
```typescript
// LangGraph soft checkpoint node
async function softCheckpointPostAnalysts(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints || state.pipelineMode === 'quick') return {}

  const humanInput = interrupt({
    stage: 'analyst_review',
    type: 'soft',
    analystAssessments: state.analystAssessments,
    riskProfile: state.riskProfile,
    prompt: 'Review analyst perspectives before debate begins.',
  })

  // If no input or user says "continue" → proceed
  if (typeof humanInput === 'string' && humanInput !== 'continue') {
    return { humanCorrectionPreDebate: humanInput }
  }
  return {}
}
```

### Hard Checkpoints (Human Decides)
**Pattern:** Pipeline pauses, user must make explicit choice

Examples:
- After debate (user confirms or corrects assumptions)
- After stress test (user selects risk scenario)

**User Experience:**
```
1. Analysis reaches checkpoint
2. Hard checkpoint card appears with decision options
3. User MUST click a button to proceed (no auto-continue)
4. Pipeline resumes with user's choice
```

**Implementation:**
```typescript
async function checkpoint1Node(state: State): Promise<Partial<State>> {
  if (state.skipCheckpoints) return {}

  const humanInput = interrupt({
    stage: 'debate_resolution',
    debateResolution: state.debateResolution,
    prompt: 'Review the debate resolution. Provide corrections or approve to continue.',
  })

  if (typeof humanInput === 'string' && humanInput.length > 0) {
    return { humanCorrectionAtDebate: humanInput }
  }
  return {}
}
```

---

## Checkpoint 1: After Debate

**When:** After Bull/Bear debate converges (2-3 rounds)

**What User Sees:**
- Debate summary card showing:
  - Bull's final position & reasoning
  - Bear's final position & reasoning
  - Areas of agreement
  - Key concessions from each side
  - Unresolved disagreements

**What User Can Do:**
1. **Approve:** "Consensus looks right, proceed"
2. **Correct:** Provide domain knowledge (e.g., "Actually, geopolitical tensions just eased")
3. **Challenge:** Flag a disagreement as important

**Example:**
```
Debate Outcome: Oil prices will fall 10%, impacting VFV negatively

User's domain knowledge: "My contacts say OPEC meeting next week likely cuts production"

User input: "Disagree with consensus. Oil more likely flat or up. Assume +2% oil move."

Result: Risk team uses "+2% oil" assumption instead of "-10% oil"
```

**Why This Works:**
- Debate represents consensus after adversarial challenge
- User's domain knowledge at this point is highest-value input
- Risk team is about to run—better to correct now than after all 3 agents finish

**Hard Checkpoint:** Yes (user must explicitly approve or provide input)

---

## Checkpoint 2: After Stress Test

**When:** After Monte Carlo simulation completes (10k scenarios computed)

**What User Sees:**
- 3 stress scenarios with dollar impacts:
  - **Base Case:** Market correlation normal, analyst consensus plays out
  - **Downside (-1σ):** More volatile market, correlation amplifies losses
  - **Tail Risk (-2.5σ):** Extreme scenario, major portfolio hit
- Button for each scenario: "Plan for Base", "Plan for Downside", "Plan for Tail"

**What User Does:**
Select their risk appetite → fund manager generates recommendations calibrated to that scenario

**Example:**
```
Base Case:   VFV -$100
Downside:    VFV -$300
Tail Risk:   VFV -$600

User selects: "Plan for Downside"

Fund Manager then generates recommendations assuming -$300 scenario
(not -$100, which might be too optimistic)
```

**Why This Works:**
- Monte Carlo shows full risk distribution
- User's risk tolerance is personal
- Fund Manager should optimize for the user's chosen scenario, not an average
- Transforms recommendations from "here's what to do" → "here's what to do if you want to handle the downside"

**Hard Checkpoint:** Yes (user must select scenario before recommendations generated)

---

## Soft Checkpoint: Post-Analysts

**When:** All 4 analysts complete, before debate starts

**What User Sees:**
- Summary of 4 analyst perspectives
- Agreement/disagreement matrix
- Key differences in approach

**What User Can Do:**
- Provide context that might change debate: "Earnings came out yesterday, consensus changed"
- No input → debate proceeds with analyst consensus as baseline

**Implementation:** Auto-continue after 60 seconds if no input

---

## Soft Checkpoint: Post-Risk-Challenge

**When:** Risk management team finishes challenging assumptions

**What User Sees:**
- List of assumptions that were challenged
- Why each was challenged (statistical outliers, logical inconsistencies, etc.)
- Revised magnitudes after challenges

**What User Can Do:**
- Override a challenge: "That assumption is actually solid, market data is stale"
- Provide additional context
- No input → magnitude validation proceeds

**Implementation:** Auto-continue after 60 seconds if no input

---

## Soft Checkpoint: Post-Verdict

**When:** Judge quality gate passes and verdict is ready to brief

**What User Sees:**
- Fund Manager verdict (direction, recommendations, tradeoffs)
- Quality score (0-1)
- Preview of research brief

**What User Can Do:**
- Request tweaks to recommendations
- Ask for additional analysis
- No input → research brief generates automatically

**Implementation:** Auto-continue after 60 seconds if no input

---

## UI Components for Checkpoints

### CheckpointCard
Shows checkpoint info + decision buttons

```typescript
type CheckpointCard = {
  type: 'checkpoint'
  data: {
    stage: 'debate_resolution' | 'stress_test' | 'analyst_review' | 'risk_challenge_review' | 'verdict_preview'
    type: 'soft' | 'hard'
    message: string
    buttons: Array<{ label: string; value: string }>
    autoCompleteSeconds?: number  // Only for soft checkpoints
  }
}
```

**Hard Checkpoint (Debate):**
```
Debate Resolution Checkpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bull: Oil falls 15% → VFV negative
Bear: OPEC cuts production → Oil stable → VFV neutral

Consensus: Negative, magnitude 0.5

[Approve] [Provide Correction] [Challenge]

Auto-continues in: — (hard checkpoint, no auto)
```

**Soft Checkpoint (Analysts):**
```
Analyst Review Checkpoint
━━━━━━━━━━━━━━━━━━━━━━━━━
4 analysts completed. Review before debate?

[Continue] [Add Context]

Auto-continues in: 60s ⏱
```

### DebateSummaryCard
Shows debate details that user reviews

### StressScenarioCard
Shows 3 scenarios, user selects risk level

---

## Implementation Details

### State Management
```typescript
type PipelineState = {
  // Checkpoint user inputs
  humanCorrectionAtDebate?: string      // Checkpoint 1 input
  humanCorrectionPreDebate?: string     // Soft CP input
  humanScenarioPreference?: 'base' | 'downside' | 'tail'  // Checkpoint 2 input
  humanRiskChallengeOverrides?: string  // Soft CP input

  // Checkpoint flags
  skipCheckpoints: boolean              // For quick mode
  pipelineMode: 'quick' | 'guided'     // guided = show checkpoints
}
```

### Edge Flow
```typescript
// After debate
.addEdge('checkpoint_1', 'assumptions_challenger')

// If user provides correction, risk team runs with it
// If user approves, risk team runs without correction

// After stress test
.addEdge('checkpoint_2', 'fund_manager')

// Fund manager checks humanScenarioPreference
// Generates recommendations for chosen scenario
```

### Resume Pattern
When user reaches hard checkpoint, pipeline pauses and returns `threadId`:

```typescript
// Frontend gets:
{
  type: 'checkpoint',
  checkpoint: {
    stage: 'debate_resolution',
    debateResolution: {...},
    ...
  },
  threadId: 'analysis-signal-123-1709469600000'
}

// User submits response via:
POST /api/v2/analyze/{threadId}/resume
{
  humanInput: "Actually, ...",
  inputType: "debate_correction"
}

// Pipeline resumes from checkpoint with input
```

---

## Design Decisions

**Decision 6:** Human checkpoints at debate + stress test
- Debate: Highest-value input (user domain knowledge before risk team)
- Stress test: User chooses risk scenario (personal risk tolerance)
- Avoids checkpoints before debate (no info yet) or after verdict (too late)

**Decision:** Soft checkpoints auto-continue
- Prevents blocking on optional reviews
- User can still intervene if they want
- Balances autonomy with interactivity

---

## User Experience Flow

### Guided Mode (with checkpoints)
```
Click Analyze
↓
[Progress bar streaming]
↓
Analyst team completes
↓
[Soft CP: "Review before debate?" Auto-continues in 60s]
↓
Debate runs
↓
[Hard CP: "Bull says negative, Bear says neutral. Which do you believe?"] ⏸
↓
[User corrects: "Actually, OPEC meeting signals cuts"]
↓
Risk team runs (with user's assumption)
↓
Stress test runs
↓
[Hard CP: "Plan for base, downside, or tail risk?"] ⏸
↓
[User selects: "Plan for downside"]
↓
Fund manager generates recommendations for downside scenario
↓
Judge evaluates quality
↓
[Soft CP: "Verdict ready. Proceed to brief?"] Auto-continues in 60s
↓
Research brief generates
↓
Complete
```

### Quick Mode (no checkpoints)
```
Click Analyze
↓
[Progress bar streaming]
↓
Full pipeline runs end-to-end
↓
Results appear
↓
Complete
```

---

## Testing Checkpoints

### Checkpoint 1 (Debate)
```bash
# Start guided mode analysis
curl -X POST http://localhost:3001/api/v2/analyze \
  -d '{
    "userId": "test-user",
    "signal": {...},
    "pipelineMode": "guided"
  }'

# Receive checkpoint event
event: checkpoint
data: { stage: "debate_resolution", ... }

# Resume with correction
curl -X POST http://localhost:3001/api/v2/analyze/thread-123/resume \
  -d '{
    "humanInput": "Actually, OPEC cuts likely",
    "inputType": "debate_correction"
  }'
```

### Checkpoint 2 (Stress Test)
```bash
# Same flow, but inputType is different
curl -X POST http://localhost:3001/api/v2/analyze/thread-123/resume \
  -d '{
    "humanInput": "downside",
    "inputType": "scenario_preference"
  }'
```

---

## Future Enhancements

1. **Checkpoint skipping:** User can "trust this stage" to skip checkpoint
2. **Checkpoint history:** Show all checkpoint decisions made
3. **Rewind analysis:** Go back and change a checkpoint decision
4. **Checkpoint timing:** Auto-extend timeout if user is reviewing
5. **Mobile-specific UX:** Optimize checkpoint cards for phone input
