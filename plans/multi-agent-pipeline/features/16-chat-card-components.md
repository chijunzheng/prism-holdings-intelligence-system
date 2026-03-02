# Feature: Chat Card Components

**ID:** 16
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 03 (Codebase Cleanup)
**Tier:** 6

## Description

Build all 15+ rich card components that render inside the chat conversation. Cards replace the old multi-page UI — everything is now an inline card in the chat flow.

## Acceptance Criteria

- [ ] All card types render correctly in chat message list
- [ ] Cards are interactive (buttons, expandable sections, tappable options)
- [ ] ThinkingCard shows real-time pipeline progress
- [ ] CheckpointCard captures user input and submits to pipeline
- [ ] RecommendationCard has tappable options
- [ ] TransparencyCard is expandable
- [ ] ResearchBriefCard has collapsed preview + "Expand full brief"
- [ ] PortfolioReviewCard shows net vs gross comparison
- [ ] Wealthsimple-style card design (rounded corners, subtle shadows, clean typography)

## Files to Create

All under `frontend/src/components/chat-cards/`:

- `PortfolioSummaryCard.tsx` - Portfolio overview with health score
- `SignalCard.tsx` - New signal notification with action buttons
- `ThinkingCard.tsx` - Pipeline stage thinking/progress indicator
- `AnalystSummaryCard.tsx` - 4 mini-cards showing analyst perspectives
- `DebateSummaryCard.tsx` - Bull/Bear outcome with agreements
- `CheckpointCard.tsx` - User input field + tappable choices (for Checkpoint 1 & 2)
- `StressScenarioCard.tsx` - 3 tappable scenario cards with dollar impacts
- `RecommendationCard.tsx` - 2-3 plan options with calibrated ranges
- `TransparencyCard.tsx` - Expandable "How we estimated this"
- `ExposureCard.tsx` - Sector exposure breakdown
- `ConcentrationWarningCard.tsx` - Risky concentration highlights
- `PortfolioReviewCard.tsx` - Cross-signal: net vs gross impact
- `ResearchBriefCard.tsx` - Expandable research brief
- `HoldingDetailCard.tsx` - ETF breakdown + signals + AI narration
- `ChatCardRenderer.tsx` - Dispatcher that renders the right card type
- `chat-cards.css` - Shared card styles

## Implementation Details

### Card Rendering Pattern

Each card receives typed props and renders inside the message list:

```typescript
type ChatCard = {
  type: 'portfolio_summary' | 'signal' | 'thinking' | 'analyst_summary' | 'debate_summary' | 'checkpoint' | 'stress_scenario' | 'recommendation' | 'transparency' | 'exposure' | 'concentration' | 'portfolio_review' | 'research_brief' | 'holding_detail'
  data: unknown  // Typed per card
}

function ChatCardRenderer({ card }: { card: ChatCard }) {
  switch (card.type) {
    case 'portfolio_summary': return <PortfolioSummaryCard data={card.data} />
    case 'signal': return <SignalCard data={card.data} />
    // ...
  }
}
```

### Key Interactive Cards

**CheckpointCard (Checkpoint 1 — after debate):**
```
"Do you have additional context?"
[Input field for user correction]
[I expect 50bps, not 25bps]  ← Quick reply chip
[My bonds mature in 3 months]  ← Quick reply chip
[Looks right, continue ▸]  ← Default action
```

**StressScenarioCard (Checkpoint 2 — after stress test):**
```
📊 Most likely (50th %ile): -$280
📉 Downside (95% VaR): -$410
📉 Tail risk (99% CVaR): -$520
📈 Reversal probability: 18%

[Most likely]  [Downside]  [Tail risk]  [Let Prism decide]
```

**RecommendationCard:**
```
Option 1: Do nothing — Accept -$280 risk. No cost.
Option 2: Light protection — ~$400. Reduces to -$150.
Option 3: Balanced — ~$1,200. Reduces to -$70.
[Select an option]  [Customize ▸]
```

**ThinkingCard (streaming):**
```
🔍 "Searching for BOC rate decision impact..."
📊 "Found: Markets expect 25bps hike."
💭 "Rate hike → tighter monetary → bonds fall."
📉 Verdict: Bearish on bonds.
```

**TransparencyCard (expandable):**
Collapsed: "How we estimated -$280 ▸"
Expanded: Full computational derivation with volatility, correlation, calibration formula

**ResearchBriefCard (expandable):**
Collapsed: Signal name, quality score, impact range
Expanded: Full 10-section research brief rendered inline

**PortfolioReviewCard:**
```
Gross impact (naive sum): -$640
Net impact (with interactions): -$180
"The oil drop offsets the rate hike on energy holdings."

Per-signal breakdown:
Signal 1: BOC Rate → -$280
Signal 2: Oil Price → +$60 on XEG
Signal 3: Tariff → -$80 on VFV
Interaction: Offsetting (-$640 → -$180)
```

### Styling Guidelines

- Border radius: 12px
- Background: white with subtle shadow (0 1px 3px rgba(0,0,0,0.08))
- Font: system-ui, -apple-system
- Primary color: Prism purple (existing)
- Status colors: 🟢 green (#00C853), 🟡 amber (#FFB300), 🔴 red (#FF1744)
- Cards stack vertically with 12px gap
- Max width: 600px (chat cards shouldn't stretch too wide)

## Testing Requirements

- [ ] Each card renders without errors given valid props
- [ ] Interactive cards fire callbacks on user interaction
- [ ] CheckpointCard submits user input correctly
- [ ] TransparencyCard expands/collapses
- [ ] ResearchBriefCard expands/collapses
- [ ] Cards render well on mobile (< 600px)

## Implementation Checklist

- [ ] Create ChatCardRenderer dispatcher
- [ ] Implement PortfolioSummaryCard
- [ ] Implement SignalCard
- [ ] Implement ThinkingCard (streaming)
- [ ] Implement AnalystSummaryCard
- [ ] Implement DebateSummaryCard
- [ ] Implement CheckpointCard
- [ ] Implement StressScenarioCard
- [ ] Implement RecommendationCard
- [ ] Implement TransparencyCard (expandable)
- [ ] Implement ExposureCard
- [ ] Implement ConcentrationWarningCard
- [ ] Implement PortfolioReviewCard
- [ ] Implement ResearchBriefCard (expandable)
- [ ] Implement HoldingDetailCard
- [ ] Style all cards
- [ ] Write component tests
