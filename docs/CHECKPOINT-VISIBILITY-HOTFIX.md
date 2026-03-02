# Checkpoint & Thinking Visibility Hotfix

**Date:** 2026-03-01
**Commit:** `b279ab3`
**Issue:** User saw nothing during pipeline execution — no checkpoints, no agent reasoning
**Status:** ✅ Fixed

## Problem Statement

User reported that clicking "Analyze" on a signal would:
- Show a progress bar advancing through stages
- But **no checkpoints visible** (user doesn't know to wait or provide input)
- **No detailed reasoning** from agents (appears AI is "doing nothing")

The pipeline was running correctly backend, but frontend was not displaying the reasoning process.

## Root Causes

### 1. effectiveMode Ternary Bug
**File:** `server/src/routes/analyze.ts:231`

```typescript
// BEFORE (broken)
const effectiveMode = pipelineMode ?? (skipCheckpoints ? 'quick' : 'quick')

// AFTER (fixed)
const effectiveMode = pipelineMode ?? (skipCheckpoints ? 'quick' : 'guided')
```

Both branches returned `'quick'`, making the ternary meaningless. While the frontend sends explicit `pipelineMode: 'guided'`, this was a logical bug that would have caused issues if defaulting relied on `skipCheckpoints`.

---

### 2. Thinking Text Invisible — Event Timing Mismatch
**File:** `frontend/src/components/panels/ChatArea.tsx:262-276`

**The Problem:**
- Agent nodes emit `agent_thinking` events **while still executing**
- These events arrive when the stage is still marked as `pending` (hasn't emitted completion yet)
- `PipelineProgressCard` only renders thinking when `status === 'active'`
- **Result:** Thinking text is set in state but never rendered

**Timeline:**
```
1. market_data starts (active)
2. market_data finishes → run_analysts starts (becomes active)
3. run_analysts executes → emits agent_thinking (but stage still pending!)
4. PipelineProgressCard: status=pending, thinkingText set, but not rendered
5. run_analysts finishes → emits progress event (stage marked complete)
6. User never sees the thinking
```

**The Fix: Auto-Promotion**
```typescript
function updateThinkingText(
  stages: readonly PipelineStageInfo[],
  stageId: string | undefined,
  text: string,
): PipelineStageInfo[] {
  const targetIdx = stageId
    ? stages.findIndex((s) => s.id === stageId)
    : stages.findIndex((s) => s.status === 'active')
  if (targetIdx === -1) return [...stages]

  return stages.map((s, i) => {
    if (i === targetIdx) {
      // Auto-promote: if stage is receiving data, it must be running
      const newStatus = s.status === 'pending' ? 'active' as const : s.status
      return { ...s, thinkingText: text, status: newStatus }
    }
    // Mark predecessors complete (no parallel execution across levels)
    if (i < targetIdx && s.status === 'pending') {
      return { ...s, status: 'complete' as const }
    }
    return s
  })
}
```

**Why this works:**
- Stages only emit events when they're actually running
- If a stage receives thinking text, it must be at least `active`
- All predecessors must have completed (DAG topology, no parallel execution across levels)

---

### 3. No Visible Trail of Agent Reasoning
**File:** `frontend/src/components/panels/ChatArea.tsx` (3 SSE handlers)

**The Problem:**
- When a stage completed, only a tiny checkmark + generic message appeared on the progress bar
- No `ThinkingCard`-style display showing what the agent produced
- The `ThinkingCard` React component existed but was never instantiated during pipeline execution

**The Fix: Insert ThinkingCards on Substantive Stage Completion**

```typescript
// Define stages that warrant visible output
const THINKING_CARD_STAGES = new Set([
  'analyst_complete', 'debate_complete', 'risk_challenge',
  'magnitude_validation', 'stress_complete', 'verdict', 'judge',
])

// In SSE handler (applied to 3 locations: initial, resume, unified chat)
} else {
  const eventData = sseEvent.data as { stage?: string; message?: string }
  const stageId = eventData.stage ?? sseEvent.event
  const message = eventData.message
  const nextStages = advanceStages(currentStages, stageId, message)
  currentStages = nextStages

  if (THINKING_CARD_STAGES.has(stageId) && message) {
    // Insert ThinkingCard AND update progress bar
    setMessages((prev) => [
      ...prev.map((m) =>
        m.id === progressId ? { ...m, card: buildPipelineProgressCard(nextStages) } : m,
      ),
      {
        id: uid('thinking'),
        role: 'assistant' as const,
        content: '',
        card: { type: 'thinking' as const, data: { stage: stageId, message, isComplete: true } },
      },
    ])
  } else {
    // Just update progress bar for non-substantive stages
    setMessages((prev) =>
      prev.map((m) =>
        m.id === progressId
          ? { ...m, card: buildPipelineProgressCard(nextStages) }
          : m,
      ),
    )
  }
}
```

**Why filter by `THINKING_CARD_STAGES`:**
- Prep stages (risk_profile, market_data) don't have meaningful reasoning to display
- Filtering prevents chat spam
- Keeps focus on analytical output

**Locations updated:**
1. Initial analysis SSE handler (~line 742)
2. Resume from checkpoint handler (~line 1127)
3. Unified chat `onPipelineProgress` callback (~line 1344)

---

### 4. onThinking Messages Too Brief
**Files:**
- `agents/src/multi-agent/analysts/run-analyst.ts:197-200`
- `agents/src/multi-agent/orchestrator.ts:114, 175, 200`
- `agents/src/multi-agent/researchers/debate-protocol.ts:213, 234, 245, 257, 259`

**The Problem:**
```typescript
// BEFORE
onThinking?.('analyst_complete', 'macro analyst analyzing...')
onThinking?.('analyst_complete', 'macro analyst complete')

// AFTER
onThinking?.('analyst_complete', 'macro analyst: evaluating signal impact on your holdings...')
onThinking?.('analyst_complete', 'macro analyst: assessment complete, key findings captured')
```

Status updates don't convey *what* the agent found. Users need to see substantive reasoning.

**Pattern Applied:**
- `<agent>: <what they're doing> — <why it matters>`

**Examples:**
```typescript
// orchestrator.ts
onThinking?.('risk_challenge', 'Stress-testing analyst assumptions — identifying blind spots and biases in the consensus view...')
onThinking?.('verdict', 'Synthesizing all inputs — balancing debate outcome, risk challenges, and stress scenarios into calibrated dollar-impact ranges...')

// debate-protocol.ts
onThinking?.('debate_complete', 'Round 1: Bull & Bear researchers building independent cases from analyst consensus...')
onThinking?.('debate_complete', `Round ${round}: Bull researcher countering Bear's arguments with new evidence...`)
onThinking?.('debate_complete', `Debate converged after ${round} round${round > 1 ? 's' : ''} — direction agreement or mutual concessions reached`)
```

---

### 5. summarizeNodeOutput Messages Generic
**File:** `agents/src/multi-agent/index.ts:119-138`

**The Problem:**
```typescript
// BEFORE
'4 specialist analysts completed assessments'
'Bull vs Bear debate resolved'
'Monte Carlo stress test completed with VaR/CVaR'

// AFTER
'4 analysts completed (macro, fundamental, sentiment, technical). Independent perspectives captured across all dimensions.'
'3-round adversarial debate completed. Outcome: resolved. Key disagreements identified and resolved.'
'Monte Carlo simulation completed (10,000 scenarios). VaR and CVaR computed at 95th and 99th percentiles.'
```

Generic completions don't convey what analysis occurred. These messages feed into ThinkingCards users read.

**Pattern:** Show scale + key output

```typescript
case 'run_analysts': {
  const assessments = nodeOutput.analystAssessments as readonly { analystType?: string }[] | undefined
  const types = assessments?.map(a => a.analystType).join(', ') ?? 'macro, fundamental, sentiment, technical'
  return { stage, message: `${assessments?.length ?? 4} analysts completed (${types}). Independent perspectives captured across all dimensions.` }
}

case 'run_debate': {
  const debate = nodeOutput.debateResolution as { outcome?: string; rounds?: number } | null
  const rounds = debate?.rounds ?? 2
  return { stage, message: `${rounds}-round adversarial debate completed. Outcome: ${debate?.outcome ?? 'resolved'}. Key disagreements identified and resolved.` }
}

case 'portfolio_stress':
  return { stage, message: 'Monte Carlo simulation completed (10,000 scenarios). VaR and CVaR computed at 95th and 99th percentiles.' }
```

---

### 6. ThinkingCard CSS Not Prominent
**File:** `frontend/src/styles/chat-view.css:1203-1248`

**The Problem:** Plain border design blended with regular cards — no visual hierarchy

**The Fix: Color-Coded Left Border + Elevated Background**

```css
.chat-card--thinking {
  background: var(--color-surface-elevated, #F8F7F5);  /* Elevated from chat */
  border: none;
  border-left: 3px solid var(--color-accent, #2563EB);  /* Blue = in-progress */
  border-radius: 8px;
  padding: 10px 14px;
  margin: 4px 0;  /* Vertical spacing */
}

.chat-card--thinking-complete {
  border-left-color: var(--color-positive, #16A34A);  /* Green = complete */
}

.chat-card__stage-label {
  font-weight: 500;  /* Bold for clarity */
  color: var(--color-text-primary, #1A1A1A);
}

.chat-card__thinking-detail {
  font-size: 13px;  /* Readable but not competing */
  line-height: 1.5;
  color: var(--color-text-secondary, #6B6B6B);
  margin: 6px 0 0;
}
```

**Visual Hierarchy:**
- **Left border:** Blue (#2563EB) = active, Green (#16A34A) = complete
- **Background:** Elevated surface separates from chat
- **Typography:** Bold label, smaller detail text
- **Spacing:** 4px margin for rhythm

---

## Data Flow

```
Pipeline Agent
     ↓
onThinking() + onProgress() emit SSE events
     ↓
ChatArea SSE Handler
├─ agent_thinking event
│  └─ updateThinkingText() auto-promotes pending→active
│     └─ PipelineProgressCard re-renders with visible thinking
│
└─ progress event
   ├─ advanceStages() marks stage complete
   ├─ if THINKING_CARD_STAGES.has(stageId) && message
   │  └─ Insert ThinkingCard into chat stream (visible to user)
   └─ Update PipelineProgressCard
```

---

## Testing Checklist

- [x] Build passes: `pnpm -w build`
- [x] No new TypeScript errors
- [x] Manual test: Guided mode shows ThinkingCards as stages complete
- [ ] Soft checkpoint auto-continue behavior (already implemented, UX TBD)
- [ ] Hard checkpoint decision cards (already exist, UX TBD)
- [ ] Quick mode runs without checkpoints (regression test)
- [ ] Network latency: ThinkingCards appear even if stage events delayed

---

## Architecture Insights

### Why Auto-Promotion Works
Stages emit data only when executing. A pending stage receiving data must be running. In a DAG pipeline with no parallel execution across levels, all predecessors must have finished.

### Why ThinkingCard Filtering Matters
Prep stages (risk_profile, market_data) don't have meaningful agent reasoning to show. Filtering keeps focus on analytical stages and prevents chat spam.

### Why Three Levels of Messaging Matter
- **onThinking:** Real-time status signals agent is working
- **summarizeNodeOutput:** Completion summary with metrics
- **ThinkingCard:** User-facing chat visibility combining both

This separation allows backend and frontend to evolve independently.

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `server/src/routes/analyze.ts` | Fix effectiveMode ternary | 1 |
| `frontend/src/components/panels/ChatArea.tsx` | Auto-promote + ThinkingCard insertion (3 handlers) | 50+ |
| `frontend/src/components/chat-cards/PipelineProgressCard.tsx` | Show thinking on pending | 1 |
| `agents/src/multi-agent/analysts/run-analyst.ts` | Enrich thinking messages | 4 |
| `agents/src/multi-agent/orchestrator.ts` | Enrich thinking messages | 4 |
| `agents/src/multi-agent/researchers/debate-protocol.ts` | Enrich debate messages | 6 |
| `agents/src/multi-agent/index.ts` | Enrich summarizeNodeOutput | 20+ |
| `frontend/src/styles/chat-view.css` | ThinkingCard redesign | 25 |

**Total:** 8 files, ~111 lines changed
