# Feature 02: Sample Data Layer — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Static JSON files with typed access layer + Zod validation at load time**

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Static JSON + Zod loader | Simple, hand-editable, fast, no DB setup | No querying capability | **Chosen** — prototype doesn't need queries |
| SQLite | Real queries, relational data | Setup overhead, migration tooling needed | Rejected — overkill |
| In-memory TypeScript objects | Zero I/O, fastest | Can't easily hand-edit for demo tuning | Rejected |
| Supabase/Postgres | Production-ready | Massive setup overhead for sample data | Rejected |

### Why This Approach

The plan explicitly states: "Static JSON files over a database — simplest for prototype, easy to hand-edit for demo tuning." The typed access layer (`data/index.ts`) adds Zod validation at load time, catching data errors before they hit the UI.

## Key Decisions

### Portfolio Design — Reverse-Engineered for Demo Impact
The portfolio isn't random — it's carefully designed so that **every current market signal (Feb 2026) hits a hidden concentration:**

| Signal | Portfolio Intersection |
|--------|----------------------|
| US tariffs | Energy (XEG) + materials (XIC) |
| Gold at $5,000+ | XGD (positive!) + XIC materials |
| Energy 17-year high | XEG + XIC energy |
| BoC rate hold | XIC + ZEB financials |
| Tech weakness | VFV tech concentration |

### ETF Changes from Original Plan
- **XQQ → XEG:** XQQ overlapped too much with VFV (both US tech). XEG creates a separate energy concentration that intersects with tariff signals.
- **XEI → XGD:** XEI overlapped too much with XIC + ZEB (all Canadian dividend). XGD creates the "one bright spot" narrative.

### Top-N Holdings Only (Important Limitation)
We model the **top 20-25 holdings per ETF**, not the full constituent list. This means:
- XIC has ~230 real constituents, we model 25 (~56% coverage)
- Concentration percentages are lower than the plan projected (17% financials vs. 38% projected)
- **This is acceptable for the prototype** — the relative ordering and overlap detection are correct
- To hit the plan's 38%, we'd need full constituent data from fund providers (costs $$$)

### Caching Strategy
- Data is loaded once and cached in module-level variables
- `getPortfolios()` returns the cached array on subsequent calls
- This is fine because sample data is static — no invalidation needed

## What I Learned

1. **Fund composition coverage matters.** Top-25 holdings for XIC only cover 56% of the fund. The remaining 44% goes to "Other" in exposure analysis, diluting sector concentrations. For a production system, you'd need Bloomberg/Refinitiv terminal data or the fund provider's full holdings file.

2. **ZEB is unusual** — it's equal-weight across 6 banks, meaning each bank is 16.7%. This makes it a perfect "concentration amplifier" when combined with XIC's bank holdings.

3. **Cross-account overlap is the key insight.** Royal Bank appears in XIC (TFSA) at 6.8% and ZEB (RRSP) at 16.7%. A user checking each account separately would never see the combined 6.8% total portfolio exposure.

4. **Data freshness tracking** is baked into the fund JSON (`dataAsOf`, `refreshFrequency`). The exposure analyzer checks this and flags stale data — important for production but mostly cosmetic in the prototype since data is all from the same date.

## Files Created

- Fund compositions: `data/funds/{VFV,XIC,ZAG,ZEB,XEG,XGD,XQQ,ZDV}.json`
- Portfolios: `data/portfolios/{demo-primary,demo-young-investor,demo-pre-retiree}.json`
- User profiles: `data/user-profiles/{profile-mid-career,profile-young,profile-pre-retiree}.json`
- Data access: `data/index.ts`
- Tests: 14 data validation tests
