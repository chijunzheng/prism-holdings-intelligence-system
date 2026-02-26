# Strategy Studio Refactor + Closed-Loop Mitigation Plan

## Context

The current `Impact Analysis` screen is overloaded. It combines signal discovery, causal graph drill-down, node details, chat, and action suggestions in one workspace. Adding closed-loop mitigation directly into this layout will increase complexity and reduce usability.

The product direction is now clear:

1. Keep impact reasoning and mitigation in one continuous workflow.
2. Preserve human decision authority (no auto-trade execution).
3. Use chat as the control surface (Cursor-like), with visual scenario editing.
4. Introduce a dedicated strategy workspace that receives context from Impact Analysis and closes the loop from analysis to portfolio response.

## Product Decision Summary (Locked)

- New workspace name: `Strategy Studio`
- Keep under Impact Analysis domain (not a separate top-level app area)
- Refactor Impact Analysis into subviews:
  - `Overview`
  - `Drill-down`
  - `Strategy Studio`
- Candidate universe: ETFs + stocks
- Liquidity constraints: no microcaps; enforce quality and volume floors
- Auto-draft behavior: only after explicit chat intent (example: "build mitigation plan")
- Default candidates surfaced: 5 (top 3 + 2 alternates)
- Scenario model for MVP: one draft + baseline comparison
- Optimization objective: minimize 1-month downside with a 6-month guardrail
- Cash increase allowed in low-confidence regimes
- Turnover caps by risk profile:
  - low: 3%
  - medium: 5%
  - high: 7%
  - hard max: 10% only with explicit user override
- Tax-aware MVP behavior:
  - prefer registered account adjustments
  - penalize taxable sells
  - warn when tax confidence is low
- Current right-panel `Actions` becomes lightweight `Quick Actions` that routes into Strategy Studio
- Ask Prism behavior:
  - no duplicate desktop button in Impact Analysis
  - keep global header entry
  - mobile FAB in Impact Analysis for discoverability

## User Workflow (Closed Loop)

1. User inspects signal impact in `Drill-down`.
2. User asks chat to build response plan.
3. System generates a draft mitigation scenario and candidate set.
4. Candidates appear in left rail; user drag/drops into canvas.
5. Simulator reruns impact against hypothetical portfolio state.
6. User compares baseline vs proposed strategy and refines.
7. User explicitly approves or rejects recommendation package.

## Human-in-the-Loop Boundary

Critical decision remaining human:

- final portfolio change approval (trade intent), because suitability, tax consequences, and account-level constraints require accountable human judgment.

## Architecture Additions

### Backend

1. `mitigation-candidate` agent module
- Input: active signal context, exposure map, profile, constraints
- Output: ranked candidates with rationale, confidence, and expected effect vector

2. `scenario-simulator` module
- Input: current portfolio + scenario operations
- Output: re-scored impact/health deltas and tradeoff metrics

3. Strategy orchestration endpoint group
- create draft scenario
- update scenario (add/remove/resize candidates)
- evaluate scenario

### Frontend

1. Impact Analysis shell refactor into subviews (state-preserving)
2. New `Strategy Studio` page composed of:
- left: candidate rail
- center: scenario canvas (drag/drop)
- right: compare/evaluation panel
3. Chat integration that can trigger draft generation and scenario updates
4. Lightweight `Quick Actions` from Drill-down to Strategy Studio

## Scoring (MVP)

`score = 0.45 * downsideReduction + 0.20 * diversificationGain + 0.15 * expectedReturn - 0.10 * turnoverCost - 0.10 * taxCost`

Hard penalties:
- concentration cap breaches
- liquidity violations
- excluded instrument types (leveraged/inverse ETFs by default)

## Refactor Strategy

Use vertical slices to reduce risk:

1. First split Impact Analysis into subviews without behavior changes.
2. Add backend contracts and deterministic simulation endpoint.
3. Ship Strategy Studio skeleton with mock rails and static draft.
4. Wire live candidates and scenario evaluation.
5. Integrate chat-driven draft generation.
6. De-scope crowded right panel into Quick Actions.

## Risk Register

1. UI complexity risk
- Mitigation: hard separation of Drill-down vs Strategy Studio responsibilities.

2. Recommendation quality risk
- Mitigation: deterministic constraints and explicit confidence display.

3. Over-trading risk
- Mitigation: strict turnover caps and hard override gate.

4. Tax oversimplification risk
- Mitigation: clear warning labels and conservative taxable-account penalties in MVP.

## Verification Plan

- Unit tests for scoring, constraints, candidate filtering, scenario transforms
- Integration tests for strategy endpoints and chat command routing
- Frontend tests for drag/drop operations and compare panel state
- Manual demo script:
  - signal -> quick action -> strategy draft -> canvas edit -> compare -> approve gate

## Exit Criteria

1. User can move from signal insight to mitigation proposal without leaving Impact Analysis context.
2. Strategy Studio produces ranked, constrained recommendations.
3. User can visually edit scenario and see recalculated effects.
4. Human approval boundary is explicit and enforced.
5. The old overloaded `Actions` behavior is reduced to simple launch affordances.
