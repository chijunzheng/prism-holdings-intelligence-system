# Feature: Tap-First Copilot (Decision Cards, Quick Replies, Guided Flow)

**ID:** 20
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 11 (Level 1 navigation), 14 (Level 3 actions)
**Phase:** 6 — Tap-First Copilot
**Plan Reference:** A10

## Description

Most everyday investors won't type questions into a chat. Prism presents **clickable choice cards** at every decision point — the user taps to advance, never needs to type.

Three prompt modes:
1. **Decision Cards** — 2-3 large tappable cards for major choices
2. **Quick Reply Chips** — horizontal scrollable pills for follow-ups
3. **Guided Flow Steps** — numbered progress for multi-step flows (like plan building)

Total taps to go from "signal detected" to "plan saved": 5 taps, zero typing.

## Acceptance Criteria

- [ ] New types: `PromptChoice`, `PromptMode`, `CopilotPromptSet`
- [ ] Ask Prism response includes optional `promptSet` field
- [ ] `buildContextualPrompts(page, context, lastResponse)` generates appropriate prompts per page
- [ ] Decision cards: full-width, stacked, with icon + title + subtitle + arrow
- [ ] Quick reply chips: horizontal scroll, pill-shaped
- [ ] Guided flow: step indicator bar + progress dots
- [ ] Tapping a card sends `choice.message` as user message
- [ ] Tapping executes `choice.copilotAction` if present
- [ ] Typing input always available at bottom
- [ ] Replaces current follow-up chips with richer `CopilotPromptSet`
- [ ] Welcome state shows decision cards instead of simple text prompts

## Implementation Details

### Files to Create

- `frontend/src/components/chat/CopilotPromptSet.tsx` — Main prompt rendering component
- `frontend/src/components/chat/DecisionCard.tsx` — Large tappable card
- `frontend/src/components/chat/QuickReplyChips.tsx` — Horizontal pill chips
- `frontend/src/components/chat/GuidedFlowHeader.tsx` — Step indicator
- `frontend/src/styles/copilot-prompts.css` — Styles for all modes
- `agents/src/chat-agent/contextual-prompts.ts` — `buildContextualPrompts()` function

### Files to Modify

- `shared/src/types/ask-prism.ts` — New types
- `frontend/src/components/portfolio/AskPrismDrawer.tsx` — Render CopilotPromptSet
- `server/src/index.ts` — Include promptSet in response
- `agents/src/chat-agent/index.ts` — Generate prompts alongside response

### New Types

```typescript
interface PromptChoice {
  readonly id: string
  readonly label: string
  readonly subtitle?: string
  readonly icon?: string
  readonly message: string
  readonly copilotAction?: CopilotAction
}

type PromptMode = 'decision_cards' | 'quick_reply' | 'guided_flow'

interface CopilotPromptSet {
  readonly mode: PromptMode
  readonly choices: ReadonlyArray<PromptChoice>
  readonly step?: { current: number; total: number; label: string }
}
```

### Context-Aware Prompt Generation

```typescript
function buildContextualPrompts(
  page: AskPrismPage,
  context: AskPrismContext,
  lastResponse?: string
): CopilotPromptSet
```

**Per-page defaults:**

| Page | Mode | Choices |
|------|------|---------|
| Portfolio (welcome) | decision_cards | "What's my biggest risk?" / "Break down my exposure" / "Review my plans" |
| Signal detail | decision_cards | "How does this affect me?" / "What should I do?" / "Is this a big deal?" |
| Plan (no selections) | guided_flow (1/3) | "Show me the impact" / "Skip to suggestions" |
| Plan (has candidates) | quick_reply | "Add more protection" / "This is enough" / "Why these choices?" |
| After any response | quick_reply | Generated from response content |

### CopilotPromptSet Component

```typescript
interface CopilotPromptSetProps {
  readonly promptSet: CopilotPromptSet
  readonly onChoiceSelect: (choice: PromptChoice) => void
}
```

Renders based on `promptSet.mode`:
- `decision_cards`: Stacked full-width cards with hover/tap states
- `quick_reply`: Horizontal scrollable pills
- `guided_flow`: Step bar at top + decision cards below

### Decision Card Layout

```
┌──────────────────────────────────────┐
│  🔴  "What's my biggest risk?"       │
│      Find the signal with the        │
│      largest potential impact    →    │
└──────────────────────────────────────┘
```

Each card: icon (left), label (bold), subtitle (muted), arrow (right).

### Integration with AskPrismDrawer

Replace current `suggestedPrompts` and `followUpQueries` rendering with `<CopilotPromptSet>`:

```tsx
// Welcome state:
{showWelcome && contextualPromptSet && (
  <CopilotPromptSet
    promptSet={contextualPromptSet}
    onChoiceSelect={handleChoiceSelect}
  />
)}

// After assistant message:
{message.promptSet && (
  <CopilotPromptSet
    promptSet={message.promptSet}
    onChoiceSelect={handleChoiceSelect}
  />
)}
```

### Choice Handler

```typescript
const handleChoiceSelect = (choice: PromptChoice) => {
  // Send choice.message as user message (appears in thread)
  sendMessage(choice.message)

  // Execute copilot action if present
  if (choice.copilotAction) {
    processCopilotAction(choice.copilotAction)
  }
}
```

## Dependencies

### Depends On
- **Feature 11:** Level 1 navigation (copilot actions on choice taps)
- **Feature 14:** Level 3 actions (apply_preset, mark_reviewed actions)

## Testing Requirements

- [ ] Unit test: `buildContextualPrompts()` returns correct mode per page
- [ ] Unit test: Decision cards render with icon, label, subtitle
- [ ] Unit test: Quick reply chips are horizontally scrollable
- [ ] Unit test: Guided flow shows step indicator
- [ ] Unit test: Choice select sends message and executes action
- [ ] Unit test: Typing input still works alongside prompt choices

## Implementation Checklist

- [ ] Add PromptChoice, PromptMode, CopilotPromptSet types
- [ ] Create `buildContextualPrompts()` function
- [ ] Create CopilotPromptSet component (all 3 modes)
- [ ] Create DecisionCard component
- [ ] Create QuickReplyChips component
- [ ] Create GuidedFlowHeader component
- [ ] Create styles
- [ ] Integrate into AskPrismDrawer (replace follow-up chips)
- [ ] Add to server response
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
