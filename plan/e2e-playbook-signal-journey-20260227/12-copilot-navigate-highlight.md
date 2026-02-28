# Feature: Copilot Navigate + Highlight (Level 2)

**ID:** 12
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 11 (Level 1 navigation must work first)
**Phase:** 4 — Navigating Copilot
**Plan Reference:** A9 Level 2

## Description

Second level: Prism navigates AND highlights a specific element on the target page. "Which holding is most affected?" → navigates to signal detail + scrolls to and pulses the ZAG node in the causal graph.

## Acceptance Criteria

- [ ] New `copilotHighlight` state in `AppContext`
- [ ] When set, target component adds CSS pulse animation + scroll-into-view
- [ ] Auto-clears after 3 seconds
- [ ] Works for: graph nodes, holding rows, signal cards, concentration warnings
- [ ] Graph nodes: `.highlighted` class with pulse animation
- [ ] Holdings rows: scroll into view + pulse
- [ ] Signal cards: scroll into view + pulse

## Implementation Details

### Files to Modify

- `frontend/src/contexts/AppContext.tsx` — Add `copilotHighlight` state
- `shared/src/types/ask-prism.ts` — Add `CopilotHighlightTarget` type
- `frontend/src/components/graph/GraphNode.tsx` — Check for highlight + pulse CSS
- `frontend/src/components/portfolio/HoldingsList.tsx` — Check for highlight + scroll
- `frontend/src/components/portfolio/SignalCardsSection.tsx` — Check for highlight
- `frontend/src/components/portfolio/AskPrismDrawer.tsx` — Set highlight on nav action
- `frontend/src/styles/global.css` — Pulse animation keyframes

### New Types

```typescript
interface CopilotHighlightTarget {
  elementType: 'graph_node' | 'holding_row' | 'signal_card' | 'warning'
  elementId: string   // node id, ticker, signal id, etc.
}

// In CopilotAction (extending from Level 1)
interface NavigateAndHighlightAction {
  type: 'navigate_and_highlight'
  route: string
  highlightTarget: CopilotHighlightTarget
  explanation: string
}
```

### AppContext Addition

```typescript
// In AppState:
copilotHighlight: CopilotHighlightTarget | null
setCopilotHighlight: (target: CopilotHighlightTarget | null) => void
```

### Component Highlight Pattern

Each component checks for highlight:

```typescript
// In GraphNode:
const { copilotHighlight } = useAppContext()
const isHighlighted = copilotHighlight?.elementType === 'graph_node'
  && copilotHighlight.elementId === node.id

// Add class:
className={`graph-node ${isHighlighted ? 'graph-node--highlighted' : ''}`}

// Scroll into view:
useEffect(() => {
  if (isHighlighted && nodeRef.current) {
    nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}, [isHighlighted])
```

### Auto-Clear Timer

In `AppContext` or the drawer:
```typescript
useEffect(() => {
  if (copilotHighlight) {
    const timer = setTimeout(() => setCopilotHighlight(null), 3000)
    return () => clearTimeout(timer)
  }
}, [copilotHighlight])
```

### CSS Pulse Animation

```css
@keyframes copilot-pulse {
  0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
  100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
}

.graph-node--highlighted,
.holding-row--highlighted,
.signal-card--highlighted {
  animation: copilot-pulse 1.5s ease-in-out 2;
  outline: 2px solid rgba(99, 102, 241, 0.6);
  outline-offset: 2px;
}
```

## Dependencies

### Depends On
- **Feature 11:** Level 1 navigation (drawer stays open, navigation works)

### Blocks
- **Feature 14 (Level 3):** Navigate + Act builds on highlight

## Testing Requirements

- [ ] Unit test: `copilotHighlight` state sets and clears in AppContext
- [ ] Unit test: GraphNode adds highlighted class when targeted
- [ ] Unit test: Auto-clear fires after 3 seconds
- [ ] Manual: Ask Prism "which holding is most affected?" → node pulses

## Implementation Checklist

- [ ] Add `CopilotHighlightTarget` type
- [ ] Add `copilotHighlight` to AppContext
- [ ] Add auto-clear timer
- [ ] Update GraphNode with highlight check + CSS class
- [ ] Update HoldingsList with highlight check + scroll
- [ ] Update SignalCardsSection with highlight check
- [ ] Add pulse animation CSS
- [ ] Wire highlight action in AskPrismDrawer
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
