# Feature: Signal Detail — Impact-First Layout + Path Insight

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 01

## Description

Restructure the signal detail center pane to lead with the signal story and impact summary (always visible above tabs), add a "Path Insight" inline section replacing the NodeDetailSheet bottom modal, and rename tabs to Causal Map / Holdings / Sources.

## Acceptance Criteria

- [ ] Signal headline, meta badges, and portfolio summary appear at top of center column (above tabs)
- [ ] Tabs renamed: "Causal Map" (default), "Holdings", "Sources"
- [ ] Clicking a graph node shows Path Insight inline below tabs: node label, type badge, confidence, dollar impact, description, temporal classification
- [ ] Path Insight has "Discuss with Prism" button that opens AskPrismDrawer with node context
- [ ] NodeDetailSheet bottom modal no longer renders on signal detail page
- [ ] DetailTabs supports controlled mode (parent can drive active tab via props)

## Implementation Details

### Files to Modify

- `frontend/src/routes/signals/SignalDetailPane.tsx` — Add signal story header above tabs. Add Path Insight section below tabs. Remove NodeDetailSheet import/render. Wire "Discuss with Prism" to `setActiveSidebarContext` + `setAskPrismOpen`.
- `frontend/src/components/signal/DetailTabs.tsx` — Add optional `activeTabId?: string` + `onTabChange?: (id: string) => void` props for controlled mode.
- `frontend/src/styles/signals-workspace.css` — Add `.signal-hero` styles (headline, meta, summary above tabs), `.path-insight` styles (inline node detail card with CTA).

### Key Components

1. **Signal Hero Section** — Reuses `SignalStory` component data but rendered at top of center column, not inside a tab.
2. **Path Insight** — New inline section. Shows when `selectedNode` is set. Card-like appearance with node info + "Discuss with Prism" button.
3. **DetailTabs controlled mode** — When `activeTabId` provided, parent controls which tab is active. Used to auto-switch tabs on node select events.

### Existing Components Reused

- `SignalStory` (`frontend/src/components/signal/SignalStory.tsx`) — for headline, meta, portfolio summary
- `AffectedHoldingsTable` (`frontend/src/components/signal/AffectedHoldingsTable.tsx`) — Holdings tab
- `EvidenceSection` (`frontend/src/components/signal/EvidenceSection.tsx`) — Sources tab
- `CausalGraph` (`frontend/src/components/graph/CausalGraph.tsx`) — Causal Map tab, `mode="canvas"`
- `SignalImpactSidebar` (`frontend/src/components/signal/SignalImpactSidebar.tsx`) — right sidebar (unchanged)
- `AppContext` — `setAskPrismOpen`, `setActiveSidebarContext`

## Testing Requirements

- [ ] Build passes
- [ ] Signal story visible at top of center column
- [ ] Graph node click → Path Insight appears inline
- [ ] "Discuss with Prism" → drawer opens

## Implementation Checklist

- [ ] Update DetailTabs for controlled mode
- [ ] Add signal hero to SignalDetailPane
- [ ] Add Path Insight section
- [ ] Remove NodeDetailSheet from SignalDetailPane
- [ ] Wire Discuss with Prism CTA
- [ ] Add CSS styles
- [ ] Verify build passes

---

**Created:** 2026-02-27
