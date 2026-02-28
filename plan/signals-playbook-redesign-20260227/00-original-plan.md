# Signal Detail + Playbook Redesign

## Design Principles

- **Signal Detail**: Inform users about signals impacting their holdings → prompt them to act via the Playbook.
- **Playbook**: Given the signal impacts, recommend securities that help mitigate → explain why → let the user decide.
- **Wealthsimple layout pattern**: Wide main column (~65-70%) + narrower sidebar (~30%). No cramped panels. The main column is where ALL primary content lives. Sidebar is for secondary actions, summaries, quick links. Generous vertical spacing between sections. White cards on warm gray bg. Clean, unhurried.

---

## Part 1: Signal Detail Page

### Layout: Wide Main + Sidebar (matching Wealthsimple proportions)

Drop the current 3-col grid (280px | 1fr | 320px). Replace with Wealthsimple's 2-col pattern:

```
SIGNALS PAGE: 2-column layout (1fr main | 340px sidebar)
with a thin signal-list strip at the top of the main column

┌─────────────────────────────────────────────────────────┬─────────────────┐
│  MAIN COLUMN (~65-70%)                                  │  SIDEBAR (340px)│
│                                                         │                 │
│  ┌─────────────────────────────────────────────────┐   │  Impact         │
│  │ [← All] [Signal 1] [Signal 2] [Signal 3] [+2]  │   │  Breakdown      │
│  └─────────────────────────────────────────────────┘   │                 │
│                                                         │  -$340          │
│  Gold Prices Decline Amid Geopolitical                  │  [1W] [1M] [6M]│
│  Tensions and Dollar Strength                           │                 │
│  🟡 Medium · Structural · 2h ago                       │  VFV    -$180   │
│                                                         │  XIC    -$120   │
│  Your portfolio faces an estimated -$340                │  ZEB     -$40   │
│  impact across 4 holdings...                            │                 │
│                                                         │  ────────────── │
│  ┌─────────────────────────────────────────────────┐   │  Counterfactual │
│  │  [Causal Map]  [Holdings]  [Sources]            │   │  "What if..."   │
│  │                                                  │   │                 │
│  │  (graph ~380px / holdings table / sources)      │   │  ┌───────────┐  │
│  │                                                  │   │  │Build Plan→│  │
│  └─────────────────────────────────────────────────┘   │  └───────────┘  │
│                                                         │                 │
│  PATH INSIGHT (when node clicked)                       │  Discuss with   │
│  Node · Type · 85% Confidence                           │  Prism          │
│  Description... [Discuss with Prism]                    │                 │
│                                                         │                 │
└─────────────────────────────────────────────────────────┴─────────────────┘
```

### Key Design Decisions

1. **Signal list becomes a horizontal chip strip** at the top of the main column — not a permanent left panel eating 280px. Clicking a chip loads that signal. "All" chip returns to combined view. Overflow shows "+N more" dropdown. This matches how Wealthsimple uses horizontal tabs/pills (e.g., Holdings/Watchlist tabs, 1M/3M/6M time toggles).

2. **Main column is wide** — gets the full story, graph, tabs, and path insight. No compression.

3. **Sidebar (340px)** — impact breakdown, horizon toggle, counterfactual, "Build a Plan" CTA, "Discuss with Prism." Matches Wealthsimple's right sidebar (action buttons, holdings list, quick links).

4. **Path Insight inline** — below tabs in the main column. Replaces NodeDetailSheet bottom modal. "Discuss with Prism" button scoped to node.

5. **Combined view at `/signals`** — when "All" chip is active: main shows net portfolio impact summary + contribution table. Sidebar shows combined impact card.

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/routes/signals/SignalsLayout.tsx` | Change from 3-col grid to 2-col (1fr + 340px). Remove `<SignalListPanel>`. Pass signals to outlet context for chip strip. |
| `frontend/src/routes/signals/SignalDetailPane.tsx` | Add signal chip strip at top. Add signal story header above tabs. Rename tabs: Causal Map / Holdings / Sources. Add Path Insight below tabs. Remove NodeDetailSheet. Wire "Discuss with Prism." |
| `frontend/src/routes/signals/CombinedSignalsPane.tsx` | Add signal chip strip at top. Show net impact + contribution table in main column. |
| `frontend/src/components/signal/DetailTabs.tsx` | Add `activeTabId?` + `onTabChange?` for controlled mode. |
| `frontend/src/styles/signals-workspace.css` | Rewrite: 2-col grid (1fr + 340px), signal chip strip, signal-hero, path-insight, generous spacing. Remove old 3-col + left panel styles. |

### Files to Delete/Remove

| File | Reason |
|------|--------|
| `frontend/src/components/signal/SignalListPanel.tsx` | Replaced by inline chip strip |
| `frontend/src/components/signal/SignalListItem.tsx` | Replaced by chip strip |

---

## Part 2: Playbook Page

### Layout: Centered Vertical Scroll (Wealthsimple pattern)

Wealthsimple's focused flows (transfers, trades, settings) use a **centered single-column** with generous whitespace — max-width ~800-1000px, no sidebar competing for attention. For the Playbook's decision flow, we use the same: centered layout with a 2-col section only for the candidates + evaluation.

```
┌──────────────────────────────────────────────────────────┐
│  ← Back to Signal Detail                                  │
│                                                           │
│  Build Your Plan                                          │
│  Prism found 5 options to help offset the -$340 impact   │
│  from "Gold Prices Decline Amid Geopolitical Tensions"    │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  WHY THESE CANDIDATES                   [Show graph ▾]   │
│  These positions offset your gold and energy exposure     │
│  through sector hedging and safe-haven allocation.        │
│                                                           │
│  (collapsed by default — expand to see reasoning graph    │
│   + path insight when graph node clicked)                 │
│                                                           │
├──────────────────────────────────────┬───────────────────┤
│                                      │                   │
│  RECOMMENDED POSITIONS (1fr)         │  Plan Evaluation  │
│                                      │  (340px sidebar)  │
│  ┌──────────────────────────────┐   │                   │
│  │ CNQ  Canadian Natural Res.   │   │  Before/After     │
│  │ 85% confidence               │   │  -$340 → -$255    │
│  │ Rationale: ...               │   │                   │
│  │ MER -$8 · Offsets $333       │   │  Downside: -$85   │
│  │ Allocation: [0.59] %  [Add]  │   │  Turnover: 3.4%   │
│  └──────────────────────────────┘   │  Tax: ~+$21       │
│                                      │                   │
│  ┌──────────────────────────────┐   │  Constraints ✓    │
│  │ ABX  Barrick Gold            │   │                   │
│  │ ...                          │   │  [Review plan]    │
│  └──────────────────────────────┘   │                   │
│                                      │                   │
│  [+ Add top 3 to scenario]          │                   │
│                                      │                   │
└──────────────────────────────────────┴───────────────────┘
```

### Key Design Decisions

1. **Header includes signal context** — shows the signal headline + impact that led here. Grounds the "why are we doing this" before the "here's what to do."

2. **Reasoning is collapsible** — shows a 1-2 line summary by default. Expand to see the full reasoning graph + path insight. Reduces visual clutter. The graph is important but secondary to the decision.

3. **Candidate cards stay full-width** — not crammed into a narrow panel. Each card shows: ticker, name, confidence, rationale, costs, allocation input, Add/Remove button. Generous padding, 14px corners. Full Wealthsimple card treatment.

4. **2-col for candidates + evaluation** — candidates scroll on the left (wide), evaluation summary sticks on the right (340px). Same pattern as current but with more breathing room.

5. **"Add top 3" as a bottom action** — not buried in a header chip. Clear CTA at the bottom of the candidates list.

6. **Max-width ~1100px, centered** — not edge-to-edge. Matches Wealthsimple's centered content areas.

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/routes/signal/PlanView.tsx` | Add signal context to header. Make reasoning collapsible (local state). Move "Add top 3" to bottom of candidates. Keep 2-col for candidates + sidebar. |
| `frontend/src/styles/plan.css` | `.plan-view__signal-context` (headline + impact in header). Collapsible `.plan-view__reasoning--collapsed` / `--expanded`. More generous padding/spacing. Consistent 14px radius cards. |

### What stays the same
- `CandidateCard` — no changes, full mode with generous layout
- `PlanEvaluationSidebar` — no structural changes
- `PlanConfirmation` modal — no changes
- `usePlan`, `useCausalChain` hooks — no changes
- Ask Prism FAB + Drawer — no changes

---

## Implementation Order

### Phase 1: Signals workspace → 2-column layout
Rewrite `SignalsLayout` from 3-col to 2-col (1fr + 340px). Create signal chip strip component. Remove SignalListPanel/SignalListItem. Update CSS.

### Phase 2: Signal Detail — impact-first + path insight
Add signal story header above tabs. Rename tabs. Add Path Insight inline. Remove NodeDetailSheet. Wire Discuss with Prism.

### Phase 3: Combined Signals pane update
Add chip strip to combined view. Adjust layout for 2-col.

### Phase 4: Playbook — focused decision flow
Add signal context to header. Make reasoning collapsible. Move "Add top 3" to bottom. More generous spacing.

### Phase 5: CSS polish + build verification

## Verification

1. `pnpm build` passes
2. `/signals` — 2-col layout: wide main with chip strip at top + combined impact, sidebar with summary
3. Click signal chip → center updates, URL updates, chip highlights
4. `/signals/:signalId` — story + impact at top, Causal Map/Holdings/Sources tabs, sidebar with "Build a Plan →"
5. Click graph node → Path Insight inline below tabs with "Discuss with Prism"
6. `/signals/:signalId/plan` — centered layout, signal context in header, collapsible reasoning, full-width candidate cards, evaluation sidebar
7. Add/Remove candidates → evaluation updates
8. Expand reasoning → graph visible, click node → path insight
9. Review plan → confirmation modal → confirmed banner
10. Both pages: generous Wealthsimple spacing, 14px cards, warm gray bg, wide main column
