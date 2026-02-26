# Feature: Intelligence Briefing Hero

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 01

## Description

Create the hero section at the top of the Portfolio View — a dynamic, one-sentence narrative that synthesizes the most important thing about the user's portfolio right now. This replaces the static "$40,000 CAD" heading with actionable intelligence. Changes based on health score, active signals, and concentration data.

## Acceptance Criteria

- [ ] Renders at top of Portfolio View as the hero element
- [ ] Generates a dynamic narrative sentence based on portfolio state (concentrations, signals, health)
- [ ] Includes a CTA button ("See What's Happening Now") that scrolls to signal cards
- [ ] Adapts message priority: active signal > concentration warning > general health summary
- [ ] Total portfolio value still visible but secondary (smaller, above or beside the narrative)
- [ ] Smooth fade-in animation on load

## Implementation Details

### Files to Create/Modify

- `packages/frontend/src/components/portfolio/IntelligenceBriefing.tsx` — New hero component
- `packages/frontend/src/styles/portfolio.css` — Hero section styles

### Narrative Priority Logic

```
1. If active signals exist:
   "A [event] is affecting [X]% of your portfolio. Estimated impact: -$[amount]."

2. If high-severity concentrations exist:
   "Your portfolio has [N] hidden concentrations. [Largest] alone is [X]% —
    a [relevant shock] could move $[amount]."

3. Default (healthy portfolio):
   "Your portfolio health is [grade]. [N] sectors across [M] geographies."
```

### Key Components

1. **IntelligenceBriefing** — Stateless component receiving health score, signals, exposures as props
2. **Narrative generator** — Pure function selecting and formatting the message
3. **CTA scroll behavior** — Smooth scroll to signal cards section

## Dependencies

### Depends On
- **Feature 01:** Health score for narrative generation and grade display

### Blocks
- **Feature 05:** Layout restructure places this component as the hero

## Testing Requirements

- [ ] Unit tests for narrative generator (all 3 priority paths)
- [ ] Test with 0 signals, 1 signal, 3 signals
- [ ] Test with no concentrations vs multiple concentrations

## Notes

- Keep the narrative human and conversational, not robotic
- Dollar amounts make abstract risks tangible — always include when available
- The briefing should make users feel informed, not alarmed

---

**Created:** 2026-02-25
**Last Updated:** 2026-02-25
