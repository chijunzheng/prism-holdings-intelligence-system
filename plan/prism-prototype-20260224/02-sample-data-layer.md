# Feature: Sample Data Layer

**ID:** 02
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 01

## Description

Create the pre-loaded sample data that powers the prototype: sample portfolios with Canadian ETFs, ETF composition data (top holdings with weights), and sample user profiles. Signal events are NOT pre-loaded — they come live from Gemini Search grounding (Feature 05). This is the "database" for portfolio and user data.

**The portfolio is reverse-engineered from current market conditions (Feb 2026) to maximize demo impact.** When the live Signal Monitor fires, it will find events that hit the user's hidden concentrations — creating a compelling "aha moment" every time the demo runs.

## Why This Matters — Current Market Context (Feb 2026)

The demo portfolio must be designed so live signals produce dramatic causal chains. Here's what's actually happening in markets right now:

| Live Signal | What's Happening | How It Hits Our Portfolio |
|-------------|-----------------|--------------------------|
| **US tariffs / trade war** | Supreme Court struck down IEEPA tariffs Feb 20, but 25-50% sector tariffs remain on steel, aluminum, auto, lumber. TSX rallied on ruling. | Hidden ~20% trade-exposed sector concentration (energy, materials, industrials through XIC + XEG) |
| **Gold at record $5,000+/oz** | Mining stocks surging; central bank buying 15th consecutive month | Gold miners inside XIC (~12% materials) + direct XGD holding — POSITIVE signal amid negative trade news |
| **Canadian energy 17-year high** | Energy stocks at first record since 2008, but oil forecast to drop to $58/bbl | Energy concentration through XIC (~17% energy) + XEG — competing short-term vs long-term signals |
| **BoC rate hold at 2.25%** | End of easing cycle; higher-for-longer signal | Hidden ~40% Canadian financials concentration — bank net interest margins affected |
| **Tech weakness** | Shopify -5%, Constellation -3% on rate signals | US tech through VFV (~30% tech) — rate-sensitive holdings |
| **CUSMA renegotiation** | July 2026 trade talks pending | Structural uncertainty for all Canada-US cross-border sectors |

**The key insight for the demo:** Every one of these live signals will hit the user's portfolio through a different hidden concentration. The user thinks they hold "6 diversified ETFs." Prism reveals they're actually concentrated in the exact sectors being buffeted by current events — with COMPETING effects (gold positive, tariffs negative, energy at highs but oil declining).

## Acceptance Criteria

- [ ] 3 sample user profiles with distinct contexts (young investor, mid-career, pre-retiree)
- [ ] Each profile has a portfolio across multiple account types (TFSA, RRSP, FHSA, non-registered)
- [ ] Portfolio contains 6 Canadian-listed ETFs chosen to intersect with current market signals
- [ ] ETF composition data: top 20-30 holdings per ETF with percentage weights (sourced from real fund fact sheets)
- [ ] Primary demo portfolio produces multiple hidden concentrations that current live signals will hit
- [ ] Overlap detection: at least 3-4 assets appear in multiple ETFs (Apple, Royal Bank, etc.)
- [ ] All data passes Zod schema validation from Feature 01 types
- [ ] Data freshness timestamps included per PRD requirements

## Implementation Details

### Files to Create/Modify

```
data/
├── portfolios/
│   ├── demo-primary.json          # Main demo: "diversified" but secretly concentrated
│   ├── demo-young-investor.json   # Contrast: tech + growth heavy, tariff-exposed
│   └── demo-pre-retiree.json     # Contrast: income + dividend heavy, rate-sensitive
├── funds/
│   ├── VFV.json                   # Vanguard S&P 500 Index ETF
│   ├── XIC.json                   # iShares Core S&P/TSX Capped Composite
│   ├── ZAG.json                   # BMO Aggregate Bond Index ETF
│   ├── XEG.json                   # iShares S&P/TSX Capped Energy Index ETF
│   ├── XGD.json                   # iShares S&P/TSX Global Gold Index ETF
│   └── ZEB.json                   # BMO Equal Weight Banks Index ETF
├── user-profiles/
│   ├── profile-mid-career.json    # Primary demo user (42, moderate risk)
│   ├── profile-young.json         # 25-year-old, high risk tolerance
│   └── profile-pre-retiree.json  # 58-year-old, 7 years to retirement
└── index.ts                       # Typed data access functions
```

### Primary Demo Portfolio — "The Illusion of Diversification"

The user *thinks* they hold 6 different ETFs across 3 accounts = diversified. Prism reveals:

| Holding | Ticker | Value (CAD) | Account | What User Thinks | Hidden Reality |
|---------|--------|-------------|---------|-----------------|----------------|
| Vanguard S&P 500 | VFV | $14,200 | TFSA | "US market exposure" | 30% tech concentration (rate-sensitive) |
| iShares S&P/TSX Composite | XIC | $9,800 | TFSA | "Canadian market" | 35% financials + 17% energy + 12% materials = 64% in 3 sectors |
| BMO Aggregate Bond | ZAG | $5,500 | RRSP | "Safe bonds" | Actually safe — but small relative to equity risk |
| BMO Equal Weight Banks | ZEB | $4,200 | RRSP | "Good dividends" | 100% Canadian banks — COMPOUNDS the XIC financials concentration |
| iShares Energy | XEG | $3,800 | FHSA | "Energy upside" | COMPOUNDS the XIC energy concentration; tariff-exposed |
| iShares Global Gold | XGD | $2,500 | Non-reg | "Hedge" | Actually the one thing working — gold at $5,000+ |
| **Total** | | **$40,000** | | | |

### X-Ray Reveal — What They Actually Own

When the Exposure Analyzer decomposes this portfolio, the X-Ray shows:

```
⚠️ Hidden concentrations detected across 6 holdings and 4 accounts

██████████████████████░░ Canadian Financials  38%  ← BoC rate signal, CUSMA risk
████████████░░░░░░░░░░░ US Technology         21%  ← Rate-sensitive, Shopify/tech weakness
████████░░░░░░░░░░░░░░░ Canadian Energy       16%  ← 17-year high BUT oil forecast declining
██████░░░░░░░░░░░░░░░░░ Gold & Materials      11%  ← Record $5,000/oz — POSITIVE signal
████░░░░░░░░░░░░░░░░░░░ Bonds                 9%
██░░░░░░░░░░░░░░░░░░░░░ Other                  5%

Overlapping holdings:
• Royal Bank of Canada appears in XIC + ZEB — 6.8% total exposure
• TD Bank appears in XIC + ZEB — 6.2% total exposure
• Canadian Natural Resources appears in XIC + XEG — 4.1% total exposure
• Apple appears in VFV (via S&P 500) — 7.1% single-stock concentration
```

### Why This Portfolio Design Maximizes Demo Impact

1. **Multiple hidden concentrations** — not just one. Financials (38%), tech (21%), energy (16%) are all clustered above warning thresholds.

2. **Every live signal hits something.** The Signal Monitor will find tariff news → energy/materials. Gold surge → gold/materials. BoC rate hold → financials. Tech weakness → US tech. CUSMA → cross-border sectors. There's no "quiet day" for this portfolio.

3. **Competing effects create compelling causal graphs.** Gold is surging (positive) while tariffs hurt energy (negative) while bank margins benefit from rate hold (positive) but CUSMA uncertainty looms (negative). The causal graph will have green AND red edges — the exact demo moment that shows Prism's value.

4. **The "one bright spot" narrative.** XGD (gold) is the only holding where the signal is unambiguously positive. This creates a satisfying narrative: "Most of your portfolio is under pressure from multiple directions, but your gold position is benefiting from the exact same uncertainty. Here's how it nets out."

5. **Cross-account overlap is invisible without Prism.** Banks in both TFSA (through XIC) and RRSP (through ZEB). Energy in both TFSA (through XIC) and FHSA (through XEG). A user checking each account separately would never see the combined concentration.

### ETF Selection Rationale (Changed from Original)

| Original | Replaced With | Why |
|----------|--------------|-----|
| XQQ (NASDAQ 100) | XEG (Energy) | XQQ overlaps too much with VFV (both US tech). XEG creates a separate energy concentration that intersects with tariff signals. |
| XEI (High Dividend) | XGD (Gold) | XEI overlaps too much with XIC + ZEB (all Canadian dividend). XGD creates the "one bright spot" narrative and intersects with the gold surge signal. |

### Contrast Portfolios

**Young Investor (25, high risk, TFSA only):**
- VFV $18,000, XQQ $8,000, SHOP (individual stock) $4,000
- Hidden concentration: 55% US tech, 8% single-stock in Shopify
- Live signals: Tech weakness + Shopify -5% → very high relevance, but long horizon mitigates urgency

**Pre-Retiree (58, low risk, all accounts):**
- ZAG $25,000, XIC $15,000, ZEB $10,000, ZDV (dividend) $8,000, VFV $7,000
- Hidden concentration: 45% Canadian financials, heavily rate-sensitive
- Live signals: BoC rate hold is structural for this user → "Because you're 7 years from retirement, this 45% financials concentration is urgent"
- Same market events, dramatically different urgency and recommendations

### User Profile Details

**Primary Demo User — Sarah (Mid-Career):**
- Age: 42, moderate risk tolerance
- Accounts: TFSA, RRSP, FHSA, non-registered
- Goals: Retirement at 62, children's education fund
- Financial literacy: Moderate (knows ETFs, doesn't understand look-through exposure)
- Context: Bought ETFs based on MoneySense "couch potato" recommendations without analyzing overlap

**Young Investor — Marcus:**
- Age: 25, high risk tolerance
- Accounts: TFSA only
- Goals: Long-term growth, down payment in 8-10 years
- Financial literacy: High (follows tech stocks, active on Reddit)
- Context: Concentrated in tech because "that's what's growing"

**Pre-Retiree — Diana:**
- Age: 58, low risk tolerance
- Accounts: TFSA, RRSP, LIRA, non-registered
- Goals: Retirement in 7 years, preserve capital
- Financial literacy: Moderate (trusts advisor recommendations)
- Context: Advisor put her in "safe dividend" funds — which are all Canadian financials

### Technical Decisions

- **Static JSON files** over a database — simplest for prototype, easy to hand-edit for demo tuning
- **Real fund data** sourced from Vanguard Canada, iShares, BMO fact sheets — makes the demo credible
- **Typed access layer** (`data/index.ts`) with Zod validation — catches data errors at load time, not at render time
- **Data freshness tracking** on each fund file — ETFs marked as "daily", any mutual fund data marked with actual staleness
- **Portfolio values chosen to be realistic** — $40K TFSA + RRSP + FHSA is a typical early-to-mid-career Canadian investor

## Dependencies

### Depends On
- **Feature 01:** Shared types (Portfolio, Holding, UserProfile schemas)

### Blocks
- **Feature 03:** Exposure Analyzer needs portfolio + fund composition data
- **Feature 05:** Signal Monitor needs ExposureMap (which needs portfolio data from here)

## Testing Requirements

- [ ] Unit tests: All JSON files pass Zod schema validation
- [ ] Unit tests: Portfolio value calculations are correct
- [ ] Unit tests: Fund composition weights sum to ~100% per fund
- [ ] Integration test: Data access functions return typed data correctly
- [ ] Verification: Primary portfolio produces ~38% Canadian financials, ~21% US tech, ~16% energy
- [ ] Verification: At least 4 overlapping holdings detected across ETFs

## Security Considerations

- [ ] No real user data — all sample data is fictional
- [ ] Sample portfolio values are realistic but not based on any real person

## Implementation Checklist

- [ ] Research real ETF compositions from current fund provider fact sheets
- [ ] Create primary portfolio JSON (6 ETFs, 4 accounts, $40K total)
- [ ] Create young investor portfolio JSON
- [ ] Create pre-retiree portfolio JSON
- [ ] Create fund composition JSONs (VFV, XIC, ZAG, XEG, XGD, ZEB + XQQ, ZDV for contrast portfolios)
- [ ] Create user profile JSONs with full context (age, goals, risk, accounts, backstory)
- [ ] Verify primary portfolio produces target concentration percentages
- [ ] Verify overlap detection finds Royal Bank, TD, CNRL, Apple across holdings
- [ ] Build typed data access layer with Zod validation
- [ ] Write validation tests
- [ ] Document data sources in comments (which fact sheet, what date)

## Notes

- **The portfolio is the demo.** If the X-Ray doesn't produce a dramatic reveal, nothing else matters. Tune the portfolio values until the concentration numbers are compelling.
- Fund composition data should be sourced from the most recent fund fact sheets (Feb 2026). Document the source date in each JSON file.
- The "couch potato" investor backstory for Sarah makes the demo relatable — millions of Canadians hold this exact type of ETF portfolio without understanding the hidden overlap.
- XGD as the "one bright spot" creates a satisfying demo narrative arc: mostly bad news → but here's what's working → here's what you can do about the rest.
- **If market conditions shift significantly before the demo**, the portfolio can be re-tuned by adjusting holdings/weights to match whatever signals are live. The architecture is signal-agnostic; only the sample data needs to change.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
