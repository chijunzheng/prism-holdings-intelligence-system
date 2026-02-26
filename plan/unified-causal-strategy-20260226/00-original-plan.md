# Unified Causal Strategy Canvas Plan

## Objective

Redesign Strategy Studio into a true closed-loop reasoning product where mitigation recommendations are explained in causal graph form, tightly coupled with Impact Analysis.

## User Problem

The current Strategy Studio feels like a list-based trade editor rather than an intelligence surface. Users cannot clearly see:

1. Why a candidate security was recommended.
2. Which impact channel it mitigates.
3. How this links back to the original signal.

## Product Decision

Strategy Studio center canvas becomes a **Mitigation Reasoning Graph**:

- Source: active signal
- Middle: impacted channels (holdings/sectors/exposures)
- Mitigation thesis: AI rationale per candidate
- Terminal nodes: candidate securities in scenario

This preserves a unified close loop:
`Signal detection -> impact analysis -> mitigation reasoning -> scenario evaluation`

## UX Direction (ui-ux-pro-max constrained)

1. Keep high-contrast light UI with stronger hierarchy.
2. Improve interaction clarity (hover, focus, touch targets).
3. Add explicit empty and success feedback.
4. Keep desktop + mobile responsive behavior.
5. Respect reduced motion and avoid layout shift.

## Implementation Slices

1. Add graph context handoff from Impact Analysis to Strategy Studio.
2. Build deterministic reasoning-graph transformer from signal/chain/scenario data.
3. Replace list-only scenario canvas with graph-first canvas.
4. Keep drag/drop + allocation controls + evaluate loop.
5. Improve visual system and accessibility details in strategy styles.
6. Add unit tests for reasoning graph mapping and run full verification.

## Risks

1. Synthetic reasoning edges can feel arbitrary.
   - Mitigation: deterministic scoring + explicit rationale labels on edges.
2. Graph can become visually dense.
   - Mitigation: cap impact channels and show top paths first.
3. Missing chain context in portfolio mode.
   - Mitigation: fallback channels from signal affected exposures.
