# Feature: Demo Profiles

**ID:** 02
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** None
**Tier:** 0

## Description

Create 3 new demo portfolios and user profiles designed for maximum demo impact. Each showcases different system capabilities. Also create fund data files for single stocks.

## Acceptance Criteria

- [x] Marcus (marcus-01): 4 single stocks, $30K, extremely high risk, 0 bonds
- [x] Sarah (sarah-01): 8 positions with FHSA time-horizon mismatch, $53K
- [x] Diana (diana-01): 58% financials with hidden RY overlap, $72K, 7yr horizon
- [x] Single stock fund files: NVDA.json, TSLA.json, BTCX.B.json, RY.json, ENB.json
- [x] All portfolios load correctly via existing data layer
- [x] User profiles include expectations (risk tolerance, horizon, goals)

## Files to Create/Modify

- `data/portfolios/marcus-01.json` - YOLO Redditor portfolio
- `data/portfolios/sarah-01.json` - Couch potato with FHSA bomb
- `data/portfolios/diana-01.json` - Advisor's worst nightmare
- `data/user-profiles/marcus-01.json` - High risk, short horizon
- `data/user-profiles/sarah-01.json` - Moderate, mixed horizons
- `data/user-profiles/diana-01.json` - Low risk, 7yr horizon
- `data/funds/NVDA.json` - Single stock (100% semiconductors)
- `data/funds/TSLA.json` - Single stock (100% auto/tech)
- `data/funds/BTCX.B.json` - Bitcoin ETF (100% crypto)
- `data/funds/RY.json` - Single stock (100% Canadian financials)
- `data/funds/ENB.json` - Single stock (100% energy infrastructure)

## Implementation Details

### Marcus (marcus-01) — "YOLO Redditor" (25, High Risk)

| Account | Holding | Value |
|---------|---------|-------|
| TFSA | NVDA | $15,000 |
| TFSA | SHOP | $8,000 |
| NON_REG | TSLA | $5,000 |
| NON_REG | BTCX.B | $2,000 |
| **Total** | | **$30,000** |

User expectations: high risk tolerance, 30yr horizon, goal: "maximum growth", concerns: "none, I'm young"

### Sarah (sarah-01) — "Did Everything Right... Almost" (42, Moderate)

| Account | Holding | Value |
|---------|---------|-------|
| TFSA | VFV | $14,000 |
| TFSA | XIC | $10,000 |
| RRSP | ZAG | $8,000 |
| RRSP | ZEB | $5,000 |
| FHSA | XIC | $6,000 |
| FHSA | VFV | $4,000 |
| NON_REG | XEG | $3,500 |
| NON_REG | XGD | $2,500 |
| **Total** | | **$53,000** |

User expectations: moderate risk, 20yr for retirement but 2yr for FHSA, goal: "balanced growth + house down payment", concerns: "worried about market correction affecting house savings"

### Diana (diana-01) — "Advisor's Worst Nightmare" (58, Low Risk)

| Account | Holding | Value |
|---------|---------|-------|
| RRSP | ZAG | $25,000 |
| RRSP | ZEB | $15,000 |
| TFSA | ZDV | $12,000 |
| TFSA | RY | $5,000 |
| LIRA | XIC | $10,000 |
| LIRA | ENB | $5,000 |
| **Total** | | **$72,000** |

User expectations: low risk, 7yr horizon (retirement), goal: "capital preservation + income", concerns: "need this for retirement"

### Single Stock Fund Files

For single stocks, the fund decomposition is trivial: 100% one holding, one sector. Format to match existing fund JSON structure but with a single constituent.

## Implementation Checklist

- [x] Create 5 single stock fund files
- [x] Create 3 portfolio JSON files matching existing schema
- [x] Create 3 user profile JSON files with new expectations fields
- [x] Verify data loads via existing data layer functions
- [x] Update data/index.ts exports
