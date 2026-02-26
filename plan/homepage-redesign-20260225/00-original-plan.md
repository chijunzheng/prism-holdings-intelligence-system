# Prism Homepage Redesign + Feature Brainstorm

## Context

The current Portfolio View is a **passive asset list** — it shows holdings, a pie chart, and some warnings. But Prism's core thesis is **proactive intelligence**: revealing hidden risks, surfacing live market events, and tracing causal impact through your specific holdings. The homepage should feel like a **living intelligence briefing**, not a static balance sheet.

The backend already produces rich intelligence (multi-horizon impact, temporal analysis, competing effects, tension analysis) that the frontend barely surfaces.

---

## Problem: Current Homepage Weaknesses

1. **Feels like any brokerage app** — holdings list + pie chart is table stakes
2. **No "aha moment" on load** — the key insight (you think you're diversified but you're not) isn't immediately visceral
3. **Signal cards are buried** — the live intelligence (the product's differentiator) competes with static data
4. **Right sidebar is low-value** — "15 exposure categories" and overlap list don't drive action
5. **No temporal dimension** — everything is "now"; no sense of what's coming or how things are changing
6. **No portfolio health narrative** — just numbers without meaning

---

## Proposed Homepage Redesign

### Layout: Intelligence-First, Not Holdings-First

```
┌─────────────────────────────────────────────────────────┐
│ NAV: Prism | Portfolio | Impact Analysis | Ask Prism    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── INTELLIGENCE BRIEFING (hero) ──────────────────┐  │
│  │ "Your portfolio has 3 hidden concentrations.       │  │
│  │  Canadian Financials alone is 22% — a rate shock   │  │
│  │  could move $3,600."                               │  │
│  │                                                    │  │
│  │  [See What's Happening Now ↓]                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── LIVE SIGNALS (max 3) ─────────────────────────┐   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │ │ 🔴 Signal│ │ 🟡 Signal│ │ 🟢 Signal│          │   │
│  │ │ BoC rate │ │ Oil drop │ │ Gold up  │          │   │
│  │ │ decision │ │ -3.2%    │ │ +1.8%    │          │   │
│  │ │          │ │          │ │          │          │   │
│  │ │ -$1,200  │ │ -$450    │ │ +$200    │          │   │
│  │ │ 22% port │ │ 14% port │ │ 6% port  │          │   │
│  │ │ Tap →    │ │ Tap →    │ │ Tap →    │          │   │
│  │ └──────────┘ └──────────┘ └──────────┘          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── TRUE EXPOSURE (X-Ray) ─┐ ┌── RISK RADAR ──────┐  │
│  │                           │ │                     │  │
│  │  [Interactive treemap     │ │ Portfolio Health: B+ │  │
│  │   showing proportional    │ │                     │  │
│  │   true exposure with      │ │ Diversification: ⚠️  │  │
│  │   color = risk level]     │ │ (3 concentrations)  │  │
│  │                           │ │                     │  │
│  │  Tap any sector to see    │ │ Overlap Score: 12%  │  │
│  │  which ETFs contribute    │ │ (4 shared assets)   │  │
│  │                           │ │                     │  │
│  │                           │ │ Data Freshness: ✅   │  │
│  │                           │ │ All funds current   │  │
│  └───────────────────────────┘ └─────────────────────┘  │
│                                                         │
│  ┌─── YOUR HOLDINGS ────────────────────────────────┐   │
│  │  (collapsible, secondary — not the hero)          │   │
│  │  VFV  $14,200  ████████████░░  35.5%             │   │
│  │  XIC   $9,800  ████████░░░░░░  24.5%             │   │
│  │  ...                                              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  [Disclaimer]                                           │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Intelligence Briefing as Hero** — One-sentence narrative synthesizing the most important thing about your portfolio right now. Changes daily based on signals.

2. **Signal Cards Elevated** — Full-width row, prominent dollar impact per signal. This is the differentiator; it should dominate the page.

3. **Treemap replaces Pie Chart** — Treemaps show proportional area more intuitively than pie charts for 10+ categories. Sectors are rectangles sized by exposure, colored by risk level.

4. **Risk Radar sidebar** — Replaces the current low-value sidebar. Single "portfolio health score" (A-F) based on diversification, overlap, concentration, and data freshness. At-a-glance risk posture.

5. **Holdings become secondary** — Collapsible section at bottom. Users already know what they hold; the value is in what they *don't* know.

---

## New Feature Ideas

### Tier 1: High-Impact, Backend Already Supports

#### 1. **Portfolio Health Score** (A+ to F)
Composite score from: diversification spread, concentration count, overlap %, data freshness. Simple weighted formula, no LLM needed. Gives users a single number to track over time.

#### 2. **Dollar Impact on Signal Cards**
The temporal reasoner already calculates per-asset dollar impact. Surface it prominently: "This event could move **-$1,200** across your holdings." Makes abstract signals tangible.

#### 3. **Multi-Horizon Impact Toggle**
Backend already generates 1-week / 1-month / 6-month impact estimates. Add a toggle on signal cards or the graph view: "See impact at different horizons." Shows how structural vs transient events play out differently over time.

#### 4. **Tension Alerts** ("Your portfolio is conflicted")
When competing effects exist (e.g., rate hike is bad for financials but good for bonds), surface this as a specific insight: "This event has competing effects on your portfolio — short-term pain, long-term gain." Backend already detects this.

#### 5. **"What You'd Tell Your Advisor" Flag**
Alert composer already has an "advisor call test." Surface signals that pass this threshold with a distinct badge: "This may warrant a conversation with your advisor."

### Tier 2: Moderate Effort, High Value

#### 6. **Scenario Playground** ("What if I sold XEG?")
Let users hypothetically remove/add holdings and see how their exposure map, concentration warnings, and risk score change. Pure computation (exposure analyzer), no LLM needed.

#### 7. **Historical Signal Timeline**
Store past signals and their outcomes. "Last month we flagged the BoC rate decision — here's what actually happened." Builds trust in the system over time.

#### 8. **Exposure Drift Tracking**
Compare current exposure map to what it was 1 week / 1 month ago. "Your tech exposure increased from 16% to 21% due to market movements." Helps users see passive drift.

#### 9. **Peer Comparison** (anonymous)
"Your Canadian financials concentration (22%) is higher than 85% of similar portfolios." Requires aggregate data but could use synthetic benchmarks for prototype.

#### 10. **Smart Rebalancing Suggestions**
Based on concentration warnings, suggest which ETFs to reduce/increase to improve diversification. NOT buy/sell recommendations — framed as "to reduce concentration, consider..." with tradeoffs.

### Tier 3: Ambitious, Future Direction

#### 11. **Earnings Calendar Integration**
"3 companies in your top holdings report earnings this week: RBC (Tue), TD (Wed), CNQ (Thu)." Pre-generate potential causal chains for each.

#### 12. **Correlation Heatmap**
Show how your holdings move together. High correlation = less diversification than you think. Visual representation of the "you're not as diversified as you think" thesis.

#### 13. **Tax-Loss Harvesting Alerts**
Detect holdings with unrealized losses in non-registered accounts. "XEG is down 8% — harvesting the loss could save ~$X in taxes." Requires account type awareness (already in data model).

#### 14. **Macro Dashboard**
Persistent view of macro indicators that matter to YOUR portfolio. BoC rate, oil price, USD/CAD, gold price — but only the ones relevant to your exposure. Updated in real-time.

---

## Implementation Approach

### Phase 1: Layout Redesign (Structural)
Files to modify:
- `packages/frontend/src/routes/PortfolioView.tsx` — restructure layout
- `packages/frontend/src/styles/portfolio.css` — new layout styles
- New components:
  - `IntelligenceBriefing.tsx` — hero narrative section
  - `RiskRadar.tsx` — portfolio health sidebar
  - `ExposureTreemap.tsx` — D3 treemap replacing pie chart (or keep pie chart if preferred)

### Phase 2: Surface Existing Backend Intelligence
- Enhance `SignalCard.tsx` — add dollar impact, horizon badge
- New component: `TensionAlert.tsx` — competing effects callout
- Add portfolio health score calculation to exposure hook

### Phase 3: New Features (pick from Tier 1-2)
- Scenario Playground (pure frontend + exposure analyzer)
- Multi-horizon toggle on signal cards
- Historical signal timeline (requires persistence)

---

## Verification
- Run `pnpm dev` and verify the new layout renders correctly
- Test signal card interactions → causal graph navigation still works
- Verify mobile responsiveness
- Check that all existing functionality (graph view, chat, profile switching) is preserved
