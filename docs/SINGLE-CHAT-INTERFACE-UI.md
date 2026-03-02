# Single Chat Interface — UI Architecture

**Status:** Production Ready
**Paradigm Shift:** From multi-page SPA → single conversational thread
**Key Innovation:** Rich card components + progressive disclosure
**Latency:** <10ms time-to-first-response (SSE streaming)

## Overview

Prism replaced a traditional multi-page portfolio dashboard (Portfolio page → Signal page → Plan page) with a **unified chat interface**. Everything happens in one conversation thread. The user never navigates between pages.

This document explains why this architecture works, how cards compose, and how the state flows.

---

## Design Rationale

### Why Single Chat Over Multi-Page?

**Traditional Approach (Pre-Prism):**
- User: Opens Portfolio page (sees holdings)
- User: Clicks signal → navigates to Signal page
- User: Reads analysis → clicks "Create Plan" → navigates to Plan page
- **Problem:** Context switching, navigation overhead, unclear relationship between signals/plans

**Chat Approach (Prism):**
- User: Chats with Prism in one thread
- Prism: Surfaces signals proactively as cards
- User: Clicks signal → Prism analyzes → results appear in same thread
- **Benefit:** Natural flow, persistent context, no page reloads

### AI Responsibility Boundary

Prism's UI reflects its philosophy: **AI narrates, human decides.**

```
Prism's job:
✅ Surface signals proactively
✅ Show what changed, why it matters
✅ Present 3 options with tradeoffs
✅ Explain how numbers were computed

User's job:
✅ Choose whether to act
✅ Select which plan to execute
❌ Execute trades (not Prism's job)
```

---

## Layout Architecture

```
┌─────────────────────────────────────────────┐
│ Prism Portfolio Intelligence                │  Header
├─────────────────────────────────────────────┤
│ Left Panel   │         Chat Area            │
│              │                             │  Main
│ • Holdings   │ ┌─────────────────────────┐ │  Content
│ • Sessions   │ │ Signal: Oil Price Drop  │ │
│ • Expect     │ │ [Rich Card Content]     │ │
│              │ └─────────────────────────┘ │
│              │                             │
│              │ ┌─────────────────────────┐ │
│              │ │ Analysis in Progress:   │ │
│              │ │ • Analyzing investors  │ │
│              │ │ • Debate in round 2... │ │
│              │ └─────────────────────────┘ │
│              │                             │
│              │ ┌─────────────────────────┐ │
│              │ │ Recommendation Card     │ │
│              │ │ [Action Options]        │ │
│              │ └─────────────────────────┘ │
│              │                             │
│              │ [Chat Input]                │
└─────────────────────────────────────────────┘
```

---

## Chat Card Types

### 1. Signal Card
**Purpose:** Proactive alert of macro/sector event
**Data:** Signal headline, sources, relevance, urgency
**User interaction:** Click "Analyze" to trigger pipeline

```typescript
type SignalCard = {
  type: 'signal'
  data: {
    signalId: string
    headline: string
    description: string
    sources: { title: string; url: string }[]
    urgency: 'low' | 'medium' | 'high' | 'critical'
    relevanceScore: number  // 0-1
    affectedExposures: string[]  // Tickers affected
  }
}
```

**Why it matters:** Users don't have to ask "what signals should I care about?" Prism surfaces them.

---

### 2. Pipeline Progress Card
**Purpose:** Real-time visibility into analysis pipeline
**Data:** Stage-by-stage progress with thinking text
**User interaction:** Visual feedback (no interaction needed)

```typescript
type PipelineProgressData = {
  stages: PipelineStageInfo[]
  error?: string
}

type PipelineStageInfo = {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete' | 'waiting'
  message?: string  // Completion summary
  thinkingText?: string  // Real-time agent reasoning
}
```

**Visual Design:**
- ✓ Checkmark = complete
- ⟳ Spinner = active
- ⏱ Timer = waiting (checkpoint)
- ○ Circle = pending

**Why it matters:** Transparency. User can see exactly what stage the analysis is in.

---

### 3. Thinking Card
**Purpose:** Show what each agent discovered
**Data:** Stage label, substantive message, completion status
**Styling:** Left border (blue active, green complete)

```typescript
type ThinkingCard = {
  type: 'thinking'
  data: {
    stage: string  // e.g., 'analyst_complete'
    message: string  // e.g., "4 analysts completed (macro, fundamental, sentiment, technical)..."
    isComplete: boolean
  }
}
```

**When shown:**
- After analyst team (all 4 complete)
- After debate (convergence reached)
- After risk challenge (assumptions tested)
- After magnitude validation (estimates bounded)
- After stress test (scenarios computed)
- After fund manager (synthesis done)
- After judge (quality verified)

**Why it matters:** ThinkingCards create a visible "thinking trail" — user sees agents working through the problem.

---

### 4. Debate Summary Card
**Purpose:** Show Bull vs Bear debate outcome
**Data:** Debate rounds, arguments, concessions, consensus
**User interaction:** (Optional) Provide correction before proceeding

```typescript
type DebateSummaryCard = {
  type: 'debate_summary'
  data: {
    rounds: number
    consensusDirection: Direction
    bullConcessions: string[]
    bearConcessions: string[]
    unresolvedDisagreements: string[]
    bullArgument: DebateArgument
    bearArgument: DebateArgument
  }
}
```

**Progressive Disclosure:**
- Collapsed: "Bull & Bear debated 2 rounds → consensus: negative"
- Expanded: Full argument text, concessions, key disagreements

**Why it matters:** Debate is where analysts are challenged. Showing the debate makes the analysis defensible.

---

### 5. Stress Scenario Card
**Purpose:** Show Monte Carlo results + let user pick risk scenario
**Data:** 3 scenarios (base, downside, tail) with impacts
**User interaction:** Select scenario to plan for

```typescript
type StressScenarioCard = {
  type: 'stress_scenario'
  data: {
    baseCase: { description: string; impacts: HoldingImpact[] }
    downsideCase: { description: string; impacts: HoldingImpact[] }
    tailCase: { description: string; impacts: HoldingImpact[] }
    userSelectedScenario?: 'base' | 'downside' | 'tail'
  }
}
```

**Visual Design:**
- 3 buttons: "Plan for Base Case", "Plan for Downside", "Plan for Tail Risk"
- Selected button highlighted
- Impact ranges shown below each

**Why it matters:** Lets user choose risk tolerance before getting recommendations. High-value human input.

---

### 6. Recommendation Card
**Purpose:** Proposed actions with tradeoffs
**Data:** 2-3 plans, each with cost/benefit/tradeoffs
**User interaction:** Select plan or customize

```typescript
type RecommendationCard = {
  type: 'recommendation'
  data: {
    signalHeadline: string
    recommendations: Recommendation[]  // Ranked by Sharpe improvement
    baselineImpact?: string  // Cost of doing nothing
  }
}

type Recommendation = {
  id: string
  title: string
  description: string
  riskReduction: string  // e.g., "$100–$200 in base case"
  estimatedCost: string  // e.g., "0.1% slippage"
  tradeoffs: string  // e.g., "Lower upside if rate cuts resume"
  isDoNothing?: boolean
}
```

**Pattern:** Always include "Do Nothing" baseline

**Example:**
```
Option 1: Reduce VFV by $50k
- Risk reduction: $100–$200
- Cost: 0.1% slippage (~$50)
- Tradeoff: Misses upside if rate cuts resume

Option 2: Sell 50% of VFV
- Risk reduction: $150–$300
- Cost: 0.2% slippage (~$100)
- Tradeoff: Larger miss if pivot to growth

Do Nothing
- Risk reduction: $0
- Cost: $0
- Downside: Exposed to full $200–$400 impact in tail scenario
```

**Why it matters:** Multiple options + baselines + tradeoffs. User makes informed decision.

---

### 7. Research Brief Card
**Purpose:** Auditable analysis document
**Data:** Full 10-section brief (markdown)
**User interaction:** Expand/collapse, download as PDF

```typescript
type ResearchBriefCard = {
  type: 'research_brief'
  data: {
    signalHeadline: string
    sections: {
      summary: string
      riskProfile: string
      analystPerspectives: string
      debateTranscript: string
      assumptions: string
      stressTest: string
      verdict: string
      holdingImpacts: string
      tradeoffs: string
      auditTrail: string
    }
  }
}
```

**Why it matters:** Full transparency. User can audit every computation, every assumption, every number's derivation.

---

### 8. Signal Impact Delta Card
**Purpose:** Summarize impact across portfolio
**Data:** Net impact, top affected holdings
**User interaction:** View/dismiss

```typescript
type SignalImpactDeltaCard = {
  type: 'signal_impact_delta'
  data: {
    signalHeadline: string
    summary: string  // e.g., "Projected 1M net impact: -$280"
    netImpactMidCad: number
    affectedHoldings: { ticker: string; name: string; impactMidCad: number }[]  // Top 5
  }
}
```

**Why it matters:** One-line summary of what the signal means for the user's portfolio.

---

### 9. Playbook Card
**Purpose:** Actionable plan with step-by-step execution guide
**Data:** Top recommendation + execution steps
**User interaction:** Review and follow steps

```typescript
type PlaybookCard = {
  type: 'playbook'
  data: {
    signalId: string
    recommendationId: string
    title: string
    rationale: string
    estimatedCost: string
    riskReduction: string
    tradeoffs: string
    steps: Array<{
      id: string
      title: string
      detail: string
    }>
    alternatives: Recommendation[]
  }
}
```

**Typical Steps:**
1. Confirm exposure scope (review affected holdings)
2. Execute adjustment (sell/buy/rebalance)
3. Re-run analysis (verify risk reduction)

**Why it matters:** Bridge between analysis and action. User knows exactly what to do.

---

## State Flow

```
User Chats
    ↓
POST /api/v2/chat (unified router)
    ↓
├─ If Q&A → Chat Agent (Gemini, retrieval context)
├─ If Signal → Analyze Pipeline (SSE streaming)
└─ If Portfolio → Portfolio Review (cross-signal synthesis)
    ↓
Frontend consumes SSE events
    ↓
├─ progress event → Update PipelineProgressCard
├─ agent_thinking event → Update ThinkingCard
├─ checkpoint event → Show CheckpointCard
├─ impact_delta event → Show SignalImpactDeltaCard
└─ complete event → Show all results (verdict, brief, playbook)
    ↓
User sees chat thread with signals, analysis, recommendations
```

---

## Progressive Disclosure Pattern

**Collapsed (Quick View):**
- Signal card title + urgency badge
- "Oil price dropped 15%" — click to analyze

**Analyzing (Progress):**
- Pipeline progress card
- ThinkingCards appearing as stages complete

**Results (Detailed View):**
- Recommendation card (2-3 options)
- Debate summary (if user clicks "View debate")
- Stress scenarios (if user clicks "View scenarios")
- Research brief (if user clicks "View full analysis")
- Playbook card (if user selects an option)

**Why it works:**
- Users who want quick advice: 2 clicks (see recommendation)
- Users who want details: Click through to research brief, audit trail
- No overwhelming information upfront

---

## Left Panel: Context Management

### Holdings Panel
**Purpose:** View portfolio holdings
**Interaction:** Click holding → search for it in chat ("Tell me about VGRO")

```typescript
type HoldingsPanel = {
  accounts: Array<{
    accountType: 'TFSA' | 'RRSP' | 'Non-Registered'
    holdings: Array<{
      ticker: string
      name: string
      valueCad: number
      allocation: number  // %
    }>
  }>
}
```

### Sessions Panel
**Purpose:** View past analyses (signal analyses, portfolio reviews)
**Interaction:** Click session → restore chat thread

### Expectations Panel
**Purpose:** View risk tolerance, time horizon, goals
**Interaction:** Click "Edit" → update preferences

---

## SSE Event Types

**Streaming format:** `event: <type>\ndata: <JSON>\n\n`

```typescript
// Stage progression
event: analyst_complete
data: { stage: "analyst_complete", message: "4 analysts completed..." }

// Real-time thinking
event: agent_thinking
data: { stage: "analyst_complete", text: "macro analyst: found rate impact..." }

// Checkpoints
event: checkpoint
data: { stage: "debate_resolution", debateResolution: {...}, prompt: "..." }

// Final results
event: impact_delta
data: { signalHeadline: "...", netImpactMidCad: -280, affectedHoldings: [...] }

event: playbook
data: { title: "...", steps: [...] }

event: complete
data: { verdict: {...}, researchBrief: {...}, intermediateArtifacts: {...} }
```

---

## Key Design Decisions

See `plans/multi-agent-pipeline/DECISIONS.md`:
- **Decision 3:** Single chat interface (vs multi-page SPA)
- **Decision 11:** Message enrichment (3 levels of detail)
- **Decision 12:** CSS color-coding (ThinkingCard left border)

---

## Performance Optimizations

1. **SSE Streaming:** User sees first response in <10ms (progress card), not <6s (final result)
2. **Card Components:** Lazy-load heavy components (research brief only if user expands)
3. **CSS Classes:** Reuse Wealthsimple design tokens (spacing, colors, typography)
4. **Message Memoization:** React.memo on card components to prevent re-renders

---

## Accessibility

- **Keyboard navigation:** All interactive elements keyboard-accessible
- **ARIA labels:** All buttons, inputs, regions have labels
- **Color contrast:** All text meets WCAG AA standards
- **Screen reader:** Card titles announced, progress conveyed via live regions

---

## Testing

**Component Tests:** Playwright E2E tests for:
- Signal card click → pipeline starts
- Progress card updates as stages complete
- ThinkingCard appears for substantive stages
- Checkpoint card waits for user input
- Result cards render all sections

**Regression:** Verify quick mode doesn't show checkpoints, thinking cards

---

## Learnings

1. **Single thread feels natural:** Users don't miss multi-page navigation
2. **Progressive disclosure works:** Users reveal details only when interested
3. **Thinking cards > progress bar:** Visible agent reasoning builds trust
4. **Playbook cards guide action:** Users know what to do after analysis
5. **Research brief = credibility:** Full audit trail convinces users the analysis is defensible
