# Feature: Copilot Navigate + Act (Level 3)

**ID:** 14
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 12 (Level 2 highlight), 13 (Unified LLM proposals)
**Phase:** 4 — Navigating Copilot
**Plan Reference:** A9 Level 3

## Description

Third and highest level: Prism navigates, highlights, AND takes action. "Help me build a plan for the BOC signal" → navigates to plan page + auto-applies the Balanced preset. "Add ZAG to my plan" → applies the add_candidate action + shows coaching comment.

The LLM generates `CopilotAction` as structured output alongside the text response.

## Acceptance Criteria

- [ ] Full `CopilotAction` type system with all action variants
- [ ] LLM generates copilot actions as structured output
- [ ] `AskPrismDrawer` processes each action type
- [ ] `navigate`: calls `navigate(route)`, keeps drawer open
- [ ] `navigate_and_highlight`: navigates + sets copilotHighlight
- [ ] `apply_plan_action`: calls `onApplyPlanActions`
- [ ] `apply_preset`: calls preset application function
- [ ] `mark_reviewed`: calls `markReviewed()`
- [ ] Falls back to text-only response if structured output fails
- [ ] Full guided journey: signal → plan → save works via tap flow

## Implementation Details

### Files to Modify

- `shared/src/types/ask-prism.ts` — Full `CopilotAction` type
- `agents/src/chat-agent/ask-prism-prompt.ts` — Add copilot action instructions to prompt
- `agents/src/chat-agent/index.ts` — Parse copilot action from response
- `server/src/index.ts` — Include copilot action in SSE response
- `frontend/src/components/portfolio/AskPrismDrawer.tsx` — Process copilot actions
- `frontend/src/hooks/useChat.ts` — Parse copilot action from streamed response

### CopilotAction Type

```typescript
type CopilotAction =
  | { type: 'navigate'; route: string; explanation: string }
  | { type: 'navigate_and_highlight'; route: string; highlightTarget: CopilotHighlightTarget; explanation: string }
  | { type: 'apply_plan_action'; actions: ReadonlyArray<AskPrismPlanAction>; explanation: string }
  | { type: 'apply_preset'; preset: 'conservative' | 'balanced' | 'aggressive'; explanation: string }
  | { type: 'open_confirmation'; explanation: string }
  | { type: 'mark_reviewed'; explanation: string }
```

### Backend: LLM Structured Output

Add to Ask Prism system prompt:
```
If the user's request implies a navigation or action, include a copilotAction
in your response as a JSON block at the end, delimited by ```copilot-action ... ```.
Only include this if the user is clearly requesting navigation or a plan change.
```

Parse from the streamed response:
```typescript
function extractCopilotAction(fullText: string): CopilotAction | null {
  const match = fullText.match(/```copilot-action\n([\s\S]*?)```/)
  if (!match) return null
  const parsed = copilotActionSchema.safeParse(JSON.parse(match[1]))
  return parsed.success ? parsed.data : null
}
```

### Frontend: Action Processing

In `AskPrismDrawer`:
```typescript
const processCopilotAction = (action: CopilotAction) => {
  switch (action.type) {
    case 'navigate':
      navigate(action.route)
      break
    case 'navigate_and_highlight':
      navigate(action.route)
      setCopilotHighlight(action.highlightTarget)
      break
    case 'apply_plan_action':
      onApplyPlanActions?.(action.actions)
      break
    case 'apply_preset':
      // Signal to plan view to apply preset
      break
    case 'mark_reviewed':
      // Signal to plan view to mark reviewed
      break
  }
}
```

### Example Guided Journey

```
User on portfolio → "Tell me about my riskiest signal"
→ CopilotAction: { type: 'navigate_and_highlight', route: '/signals/boc-rate', highlightTarget: ... }

User on signal → "What should I do?"
→ CopilotAction: { type: 'navigate', route: '/signals/boc-rate/plan' }

User on plan → "Apply the balanced option"
→ CopilotAction: { type: 'apply_preset', preset: 'balanced' }

User on plan → "Save this"
→ CopilotAction: { type: 'mark_reviewed' }
```

## Dependencies

### Depends On
- **Feature 12:** Navigate + highlight (copilotHighlight in AppContext)
- **Feature 13:** Unified LLM proposals (structured output pattern)

### Blocks
- **Feature 20 (Tap-First Copilot):** Uses copilot actions on choice card taps

## Testing Requirements

- [ ] Unit test: `extractCopilotAction()` parses valid JSON blocks
- [ ] Unit test: Returns null for responses without copilot actions
- [ ] Unit test: Each action type processed correctly in drawer
- [ ] Unit test: Invalid copilot action JSON falls back gracefully
- [ ] Integration test: Full navigate → highlight → act journey

## Implementation Checklist

- [ ] Define full CopilotAction type system
- [ ] Add copilot action instructions to Ask Prism prompt
- [ ] Implement `extractCopilotAction()` parser
- [ ] Update SSE response to include parsed action
- [ ] Process each action type in AskPrismDrawer
- [ ] Wire preset application callback
- [ ] Wire markReviewed callback
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
