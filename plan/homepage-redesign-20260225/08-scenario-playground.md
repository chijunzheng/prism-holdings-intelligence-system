# Feature: Scenario Playground

**ID:** 08
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** 01, 06

## Description

Let users hypothetically add/remove holdings and instantly see how their exposure map, concentration warnings, health score, and treemap change. Pure computation using the exposure analyzer — no LLM needed. Framed as exploration, not advice.

## Acceptance Criteria

- [ ] "What if" toggle or button opens scenario mode
- [ ] Users can remove an ETF or adjust its dollar value
- [ ] Exposure treemap/chart updates in real-time to show modified portfolio
- [ ] Health score recalculates and shows delta (e.g., "B+ → A-")
- [ ] Concentration warnings update
- [ ] Clear "This is a simulation" banner in scenario mode
- [ ] Easy exit back to actual portfolio
- [ ] Never presents changes as recommendations

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/components/portfolio/ScenarioPlayground.tsx` — Scenario mode container
- `packages/frontend/src/hooks/useScenarioPortfolio.ts` — Modified portfolio state + re-run exposure analysis
- `packages/frontend/src/styles/portfolio.css` — Scenario mode styles (distinct visual treatment)

### Key Components

1. **ScenarioPlayground** — Overlay/mode that wraps exposure section with editable holdings
2. **useScenarioPortfolio** — Clones portfolio, applies user modifications, re-runs exposure analyzer client-side
3. **Before/After comparison** — Side-by-side or overlay showing actual vs scenario

### Technical Approach

The exposure analyzer is pure TypeScript (no LLM). It can run client-side if we extract the core logic to the shared package, or we call the existing `/api/exposure` endpoint with a modified portfolio payload.

## Dependencies

### Depends On
- **Feature 01:** Health score for before/after comparison
- **Feature 06:** Treemap visualization for showing modified exposure

### Blocks
- None

## Testing Requirements

- [ ] Unit tests: modifying portfolio correctly recalculates exposure
- [ ] Test removing an ETF reduces its sector exposure
- [ ] Test health score delta calculation
- [ ] Test exit scenario mode restores actual portfolio

## Security Considerations

- [ ] Scenario mode must be clearly marked — users should never confuse simulated state with actual holdings
- [ ] No server-side state mutation from scenario mode

## Notes

- This feature transforms Prism from "here's your risk" to "here's how to improve it"
- Keep the UI simple: start with remove/adjust value only, not full add-any-ETF
- The disclaimer must be extra prominent in scenario mode

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
