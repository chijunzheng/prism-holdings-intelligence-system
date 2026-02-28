# Original Plan: Signal Contributions Theme Refactor

## Problem
- The contributions section still looks like a legacy dashboard table.
- Visual style diverges from the updated portfolio/live-signals theme.
- Cell overflow in the confidence column can render awkward artifacts.

## Plan
1. Normalize table typography and spacing to match portfolio cards.
2. Remove clipping behavior on table cells and control truncation only where needed.
3. Use neutral confidence chips (no urgency-like color coding).
4. Preserve positive/negative polarity color only for impact/direction.
5. Verify responsiveness and regression on Signals All page.
