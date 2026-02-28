# Feature: What-If Scenarios → Graph Re-render

**ID:** 15
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** 02 (Horizon sync for consistent display)
**Phase:** 4 — Navigating Copilot
**Plan Reference:** A3

## Description

`detectWhatIf()` exists in `agents/src/chat-agent/index.ts` (line 137) and classifies counterfactual questions. But it's only connected to the legacy chat hook — `useAskPrismChat` doesn't use it. "What if the Fed reverses?" gets a text answer only.

Connect what-if detection to the causal graph: the user's question literally changes the visualization. Original chain dims, alternative chain highlights.

## Acceptance Criteria

- [ ] New endpoint `POST /api/chat/:userId/what-if` processes what-if questions
- [ ] Uses existing `detectWhatIf()` to classify counterfactual intent
- [ ] Re-runs `runGraphPipeline()` with modified assumption when what-if detected
- [ ] Returns alternative causal chain + narration
- [ ] `CausalGraph` accepts `alternativeData` prop
- [ ] Original nodes render at 30% opacity, alternative at full
- [ ] Toggle button: "Original" / "What if..." switches between views
- [ ] Prism narrates the difference between scenarios

## Implementation Details

### Files to Create

- None — extends existing files

### Files to Modify

- `server/src/index.ts` — New what-if endpoint
- `frontend/src/hooks/useChat.ts` — Detect what-if and fetch alternative chain
- `frontend/src/routes/signals/SignalDetailPane.tsx` — Pass alternative data to graph
- `frontend/src/components/graph/CausalGraph.tsx` — Render alternative chain overlay
- `frontend/src/components/graph/GraphNode.tsx` — Dimmed vs full opacity rendering

### Backend: What-If Endpoint

```typescript
app.post('/api/chat/:userId/what-if', async (req, res) => {
  const { message, signalId } = req.body
  const detection = await detectWhatIf(message)

  if (!detection.isWhatIf) {
    return res.json({ isWhatIf: false })
  }

  // Re-run graph pipeline with modified assumption
  const alternativeChain = await runGraphPipeline(userId, signalId, {
    modifiedAssumption: detection.modifiedAssumption
  })

  // Generate narration comparing the two scenarios
  const narration = await generateWhatIfNarration(originalChain, alternativeChain)

  return res.json({
    isWhatIf: true,
    alternativeChain,
    narration,
    modifiedAssumption: detection.modifiedAssumption
  })
})
```

### Frontend: CausalGraph `alternativeData` Prop

```typescript
interface CausalGraphProps {
  // ... existing props
  alternativeData?: CausalChain    // NEW
  alternativeLabel?: string        // "What if oil drops?"
}
```

When `alternativeData` is present:
- Render original nodes at 30% opacity (`emphasis: 0.3`)
- Render alternative nodes at full opacity
- Show toggle: "Original" / "What if: {alternativeLabel}"
- Toggle switches which set is dimmed

### useAskPrismChat Integration

Before standard flow, check for what-if:
```typescript
const checkWhatIf = async (message: string) => {
  if (!signalId) return null
  const res = await fetch(`/api/chat/${userId}/what-if`, {
    method: 'POST',
    body: JSON.stringify({ message, signalId })
  })
  return res.json()
}
```

If what-if detected, pass `alternativeChain` up via callback to `SignalDetailPane`.

### Existing Code to Reuse

- `detectWhatIf()` in `agents/src/chat-agent/index.ts:137`
- `runGraphPipeline()` in agents — generates causal chains from signals
- `buildWhatIfDetectionPrompt()` in `agents/src/chat-agent/prompts.ts`

## Dependencies

### Depends On
- **Feature 02:** Horizon sync so alternative chain displays at the correct horizon

## Testing Requirements

- [ ] Unit test: What-if endpoint returns alternative chain when detected
- [ ] Unit test: Returns `isWhatIf: false` for non-counterfactual messages
- [ ] Unit test: CausalGraph renders original at 30% opacity when alternative present
- [ ] Unit test: Toggle switches between original and alternative
- [ ] Integration test: "What if rates drop?" → graph re-renders

## Implementation Checklist

- [ ] Create what-if endpoint
- [ ] Modify `runGraphPipeline` to accept `modifiedAssumption` parameter
- [ ] Add what-if narration generation
- [ ] Add `alternativeData` prop to CausalGraph
- [ ] Implement dual-render with opacity control
- [ ] Add toggle UI
- [ ] Connect useAskPrismChat to what-if detection
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
