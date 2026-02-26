# 11. Strategy Studio Closed-Loop Mitigation

## Summary

Impact Analysis is now split into `Overview`, `Drill-down`, and `Strategy Studio`.
Strategy Studio closes the loop from signal understanding to scenario design without auto-trading.

## Command-First Workflow

- Users enter Strategy Studio and run an explicit command like `Build mitigation plan`.
- The system generates a draft with ranked candidates and a seeded scenario.
- Users drag candidates into canvas, resize allocations, and run `Evaluate scenario`.
- Final approval remains human-only.

## Human Decision Boundary

The critical decision that must remain human is final trade approval.

Why:
- suitability and personal intent cannot be fully inferred from model context
- tax/account implications are user-specific and can be high-impact
- responsibility for real capital changes must stay with the user

## What Breaks First At Scale

First failure mode: candidate quality drift under broader symbol universe and noisy signal bursts.

Symptoms:
- repetitive or low-quality candidate sets
- unstable rationale quality across adjacent drafts
- higher false confidence in low-signal regimes

Mitigations:
- tighten deterministic filters (liquidity, concentration, instrument policy)
- add ranking telemetry and offline replay evaluation
- add confidence calibration and fallback to cash buffer when uncertainty rises

## Demo Script (2-3 Minutes)

1. Show `Drill-down`: explain active signal and one-month downside context.
2. Switch to `Strategy Studio`: run `Build mitigation plan`.
3. Point out candidate rationale/confidence and drag one additional candidate.
4. Resize one position with `Set <ticker> to <pct>%`.
5. Run `Evaluate scenario` and compare baseline vs proposed metrics.
6. Close with explicit statement: Prism recommends and simulates, user approves final changes.
