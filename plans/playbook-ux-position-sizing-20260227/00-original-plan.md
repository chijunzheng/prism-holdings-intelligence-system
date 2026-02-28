# Implementation Plan: Playbook UX + Position Suggestions

## Summary
Upgrade Playbook from a passive archive into an action workspace with clearer status, faster decisions, and executable stock sizing (target CAD + estimated shares).

## Features
1. Playbook Index UX: summary metrics, health badges, better filtering/sorting.
2. Plan Presets: one-click Conservative/Balanced/Aggressive/Low-turnover allocation presets.
3. Candidate Position Suggestions: target CAD, estimated shares, residual cash metadata.
4. Optional Backend Enrichment: include reference price/sizing metadata in strategy draft responses.
5. Validation: build/tests and review.

## Defaults
- Sizing mode: Dollar + Shares.
- Interaction model: One-click presets + manual override.
- Missing price handling: show dollar amount and mark shares unavailable.
