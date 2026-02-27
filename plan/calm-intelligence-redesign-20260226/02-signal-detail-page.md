# Feature: Signal Detail Page

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 04 (Graph Guardrails)

## Description

New scrollable page with main+sidebar layout that replaces the Impact Analysis drilldown view. Shows the signal story ("What happened" / "Why it matters to you"), affected holdings ranked by impact, an embedded causal graph, and an evidence section with citations. Entered via signal card "View analysis →" from Portfolio.

This is the most content-rich page in the app. The key design principle: **story first, graph second.** Text explanation comes before the visual graph because most users read better than they parse node-edge diagrams.

## Acceptance Criteria

- [ ] User taps signal card on Portfolio → lands on Signal Detail at `/signals/:signalId`
- [ ] Story section shows "What happened" + "Why it matters to you" with plain language
- [ ] Affected holdings table shows ticker, weight, estimated impact, mechanism chips, confidence
- [ ] Causal graph renders in embedded mode (~400px height, ≤15 nodes)
- [ ] Temporal radio toggle (1W / 1M / 6M) changes impact numbers in sidebar and graph inline
- [ ] Tapping a graph node opens a bottom sheet with mechanism details + evidence
- [ ] Evidence section shows citations with source, timestamp, and excerpt
- [ ] "What would change this view" section shows key data points to watch
- [ ] "Build a plan to reduce this risk →" CTA navigates to Plan page
- [ ] Back navigation returns to Portfolio
- [ ] Sidebar shows net impact, per-holding breakdown, temporal classification, counterfactual
- [ ] Page follows same visual pattern as Portfolio (main content + right sidebar)

## Implementation Details

### Files to Create

- `frontend/src/routes/signal/SignalDetailView.tsx` — route component
- `frontend/src/components/signal-detail/SignalStory.tsx` — "What happened" + "Why it matters" sections
- `frontend/src/components/signal-detail/AffectedHoldingsTable.tsx` — ranked holdings by impact
- `frontend/src/components/signal-detail/SignalImpactSidebar.tsx` — right sidebar
- `frontend/src/components/signal-detail/EvidenceSection.tsx` — citations + "what would change this"
- `frontend/src/components/signal-detail/NodeDetailSheet.tsx` — bottom sheet on node tap
- `frontend/src/components/signal-detail/TemporalToggle.tsx` — 1W/1M/6M radio buttons
- `frontend/src/styles/signal-detail.css` — page styles
- `frontend/src/hooks/useSignalDetail.ts` — data fetching hook

### Files to Modify

- `frontend/src/App.tsx` — add route `/signals/:signalId`
- `frontend/src/components/portfolio/SignalCard.tsx` — update "View analysis →" link to new route

### Key Components

1. **`SignalDetailView.tsx`** — Route component
   - Receives `signalId` from URL params
   - Fetches signal data + causal graph via existing endpoints
   - Manages temporal horizon state (1W/1M/6M)
   - Layout: main (65%) + sidebar (35%)

2. **`SignalStory.tsx`** — Text explanation
   - "What happened" — signal headline + description from signal monitor
   - "Why it matters to you" — generated text linking signal to user's specific exposures
   - Uses signal description + exposure map to construct personalized narrative

3. **`AffectedHoldingsTable.tsx`** — Impact ranking
   - Rows: ticker, name, portfolio weight %, estimated dollar impact, mechanism chips, confidence dot
   - Sorted by absolute impact descending
   - Each row clickable → scrolls to graph and highlights that node

4. **`SignalImpactSidebar.tsx`** — Right sidebar
   - Net 1M impact (dollar amount, colored green/red)
   - Holdings affected count
   - Per-holding impact breakdown (mini list)
   - Temporal toggle (1W / 1M / 6M) — radio buttons, updates all numbers
   - Temporal classification label (Transient / Structural / Ambiguous)
   - Counterfactual box: "If [opposite], impact reverses to +$X"
   - "Discuss with Prism →" link

5. **`EvidenceSection.tsx`** — Sources and citations
   - Citation cards: source title (linked), excerpt, timestamp
   - "What would change this view" — list of key data points / upcoming events
   - Reuses existing `SourceCitation.tsx` component

6. **`NodeDetailSheet.tsx`** — Bottom sheet overlay
   - Triggered by graph node tap
   - Shows: node label, type, description, confidence, dollar impact
   - Connected edges with mechanism labels
   - Evidence links for this node's edges
   - "Discuss this with Prism" button (opens Ask Prism with node context)

### Data Flow

```
URL: /signals/:signalId
     │
     ├── GET /api/signals/:userId → find signal by ID from cached array
     ├── GET /api/graph/:userId/:signalId → causal chain + temporal analysis
     └── GET /api/exposure/:userId → exposure map for sidebar context
```

All data is already cached by orchestrator. No new backend endpoints needed.

### Technical Decisions

- **Story text from signal monitor output:** The signal already has `headline` and `description`. "Why it matters" is constructed client-side by matching signal's `affectedCategories` to user's exposure percentages. No additional LLM call needed.
- **Temporal toggle is client-side:** The temporal analysis response already contains all 3 buckets. Switching horizons just reads a different bucket.
- **Bottom sheet, not panel:** Node details open as an overlay from the bottom, not a third column. This preserves the 2-column layout.

## Dependencies

### Depends On
- **Feature 04:** Causal Graph Guardrails — need embedded mode for the graph component

### Blocks
- **Feature 03:** Plan Page — navigation flows from Signal Detail to Plan
- **Feature 06:** Cleanup — old Impact Analysis view can't be deleted until this replaces it

## Testing Requirements

- [ ] Unit tests: SignalStory renders correctly with signal data
- [ ] Unit tests: AffectedHoldingsTable sorts by impact correctly
- [ ] Unit tests: TemporalToggle switches between buckets
- [ ] Unit tests: SignalImpactSidebar updates when temporal horizon changes
- [ ] Integration tests: route loads with valid signalId and renders all sections
- [ ] Integration tests: NodeDetailSheet opens on graph node click
- [ ] E2E test: Portfolio signal card → Signal Detail → all sections visible

## Security Considerations

- [ ] Validate signalId param (prevent injection)
- [ ] Ensure user can only view their own portfolio's signals

## Implementation Checklist

- [ ] Create route and view component
- [ ] Build story section
- [ ] Build affected holdings table
- [ ] Build sidebar with temporal toggle
- [ ] Embed causal graph in embedded mode
- [ ] Build evidence section
- [ ] Build node detail bottom sheet
- [ ] Add "Build a plan" CTA with navigation
- [ ] Wire data fetching hook
- [ ] Update Portfolio signal card links
- [ ] Add styles following Wealthsimple visual pattern
- [ ] Write tests
- [ ] Verify responsive behavior

## Notes

- The graph should NOT be the hero of this page. Story text comes first, graph is below the fold or mid-page. Users who want the graph will scroll to it.
- Mechanism chips on holdings table: short labels like "margin compression", "rate sensitivity" extracted from causal chain edge mechanisms.
- Counterfactual data comes from `temporalAnalysis.counterfactual` which already exists in the backend response.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
