# Playbook UX + Position Suggestions Plan (2026-02-27)

## Goals
- Make Playbook easier to scan and act on.
- Add executable position suggestions for each recommendation.
- Improve plan interactivity with one-click allocation presets.

## Scope
- Playbook list: better status visibility, filtering, and actionability.
- Plan detail: preset allocation chips and richer candidate guidance.
- Candidate sizing: target CAD + estimated shares when a reference price is available.

## Core Decisions
- Default sizing mode: Dollar + Shares.
- Default interaction model: one-click presets with manual override.
- If no price is available for a ticker, show dollar target and indicate shares unavailable.

## Deliverables
1. Playbook UX enhancements (health badges, saved filters, improved card metadata).
2. Plan preset controls (Conservative, Balanced, Aggressive, Low-turnover).
3. Position suggestion model and UI rendering in candidate cards.
4. Basic server support for candidate position suggestion fields.
5. Validation via build/tests and code-review pass.
