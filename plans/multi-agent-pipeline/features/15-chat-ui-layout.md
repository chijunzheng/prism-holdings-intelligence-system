# Feature: Chat UI Layout

**ID:** 15
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 03 (Codebase Cleanup)
**Tier:** 6

## Description

Build the new single-page chat interface layout: left panel (holdings + sessions + expectations) + main chat area. This replaces the entire old multi-page SPA. Wealthsimple-style: clean, minimal, lots of white space.

## Acceptance Criteria

- [ ] Single chat route replaces all old routes
- [ ] Left panel: HoldingsPanel, SessionList, ExpectationsPanel
- [ ] Main chat area with message list + input field
- [ ] Holdings panel shows real portfolio data with signal status indicators
- [ ] Tapping a holding inserts HoldingDetailCard into chat
- [ ] Session list shows signal analysis threads
- [ ] New session button creates fresh session
- [ ] Session switching restores conversation history
- [ ] Responsive layout (left panel collapses on mobile)
- [ ] Wealthsimple-style styling: system font, clean borders, white space

## Files to Create

- `frontend/src/routes/ChatView.tsx` - Main chat route
- `frontend/src/components/panels/HoldingsPanel.tsx`
- `frontend/src/components/panels/SessionList.tsx`
- `frontend/src/components/panels/ExpectationsPanel.tsx`
- `frontend/src/components/chat/ChatView.tsx` - Chat area container
- `frontend/src/hooks/useSessions.ts` - Session management
- `frontend/src/hooks/useChatMessages.ts` - Message state
- `frontend/src/styles/chat-view.css` - New styles

## Files to Modify

- `frontend/src/App.tsx` - Single route to ChatView
- `frontend/src/styles/global.css` - Wealthsimple base styling

## Implementation Details

### Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  ┌─────────────────┐  ┌──────────────────────────────┐   │
│  │  Left Panel      │  │  Main Chat Area              │   │
│  │  (280px fixed)   │  │  (flex: 1)                   │   │
│  │                  │  │                              │   │
│  │  HoldingsPanel   │  │  Message list (scrollable)   │   │
│  │  ─────────────   │  │                              │   │
│  │  SessionList     │  │                              │   │
│  │  ─────────────   │  │                              │   │
│  │  Expectations    │  │  ─────────────────────────   │   │
│  │                  │  │  ChatInput (sticky bottom)   │   │
│  └─────────────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### HoldingsPanel

Shows portfolio holdings with signal status:
```
📊 My Holdings                    $40,000
VFV  $12,400  31%  🟡  (1 moderate signal)
XIC  $8,200   21%  🟡  (1 moderate signal)
ZAG  $7,600   19%  🔴  (1 high-impact signal)
ZEB  $5,800   15%  🟢  (no active signals)
XEG  $3,200    8%  🟢  (no active signals)
XGD  $2,800    7%  🟢  (no active signals)
```

Clicking a holding:
1. Inserts `HoldingDetailCard` into chat
2. Sets context scope for chat agent
3. Highlights holding across sessions

### SessionList

Each signal analysis creates a session. Sessions have:
- Title (signal name)
- Status indicator (analyzing / complete / stale)
- Creation timestamp
- Click to switch (restores messages + cached verdicts)

### ExpectationsPanel

Compact display of user preferences:
- Risk: Moderate / Horizon: 20y / Goal: Growth
- "Edit" button opens inline form
- Changes propagate to pipeline calibration

### Session State Management

```typescript
type ChatSession = {
  id: string
  type: 'home' | 'signal' | 'portfolio_review' | 'holding'
  title: string
  signalId?: string
  messages: ChatMessage[]
  cachedVerdict?: FundManagerVerdict
  cachedBrief?: ResearchBrief
  createdAt: string
  updatedAt: string
}
```

### Existing Components to Reuse

- `ExposurePieChart` → embed in HoldingDetailCard
- `TickerIcon` → use in holdings panel
- `ConcentrationWarning` → show in HoldingDetailCard
- Health scoring (`health-scoring.ts`) → powers PortfolioSummaryCard

## Testing Requirements

- [ ] Layout renders with left panel and chat area
- [ ] Holdings load from real portfolio data
- [ ] Session creation and switching works
- [ ] Chat input submits messages
- [ ] Responsive: left panel collapses on narrow viewport

## Implementation Checklist

- [ ] Create ChatView main route
- [ ] Implement HoldingsPanel with real data
- [ ] Implement SessionList with create/switch
- [ ] Implement ExpectationsPanel
- [ ] Implement message list rendering
- [ ] Implement chat input component
- [ ] Implement session state management
- [ ] Style with Wealthsimple aesthetic
- [ ] Update App.tsx routing
- [ ] Write component tests
