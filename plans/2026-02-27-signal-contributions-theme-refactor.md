# Signal Contributions Theme Refactor

## Intent
Bring the Signals "Signal contributions" section in line with the portfolio/live-signals Wealthsimple-style monochrome UI.

## Scope
- `SignalContributionsTable` presentation and styles.
- No backend/API shape changes.

## Changes
1. Keep sentence-case headers and reduce dashboard-like visual noise.
2. Fix table cell clipping/overflow artifacts in confidence column.
3. Update weight/impact/direction/confidence row styling to match portfolio density and typography.
4. Keep color usage focused on financial polarity (+/- impact, direction) while using neutral confidence chips.

## Validation
- Run tests and frontend build check.
- Manual diff review for table component and stylesheet.
