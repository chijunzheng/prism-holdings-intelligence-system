# Original Plan: Ask Prism Placement Fix

## Goal
Remove top-right Ask Prism from navigation (it overlaps Notification Bell) and use the existing bottom-right Ask Prism FAB pattern from Portfolio.

## Steps
1. Remove nav Ask Prism trigger from `AppLayout`.
2. Reuse Portfolio FAB pattern in Impact Analysis (`ask-prism-fab` + `AskPrismDrawer`).
3. Remove conflicting auto-open behavior in Impact Analysis that hijacks `askPrismOpen`.
4. Verify with tests/typecheck/build.
