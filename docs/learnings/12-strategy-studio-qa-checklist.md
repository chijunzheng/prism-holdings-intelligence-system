# 12. Strategy Studio Manual QA Checklist

## Preconditions

- Start frontend and server locally.
- Select profile `sarah-01`.
- Open `Impact Analysis`.

## End-to-End Checks

1. Open `Drill-down`, select a signal, switch to `Strategy Studio`.
2. Confirm no draft is auto-loaded without explicit action.
3. Run command: `Build mitigation plan for this signal`.
4. Verify candidate rail populates and command response includes rationale/confidence.
5. Drag one candidate to canvas and confirm duplicate drag is ignored.
6. Run command: `Add <ticker>` for a non-canvas candidate and verify it appears.
7. Run command: `Set <ticker> to 2%` and verify slider/value update.
8. Run command: `Evaluate scenario` and verify evaluation panel updates.
9. Confirm warnings appear when turnover exceeds risk cap.
10. Switch to another signal and return to Strategy Studio.
11. Verify stale draft is cleared and user is prompted to rebuild.
12. Confirm `Quick Actions -> Open In Strategy Studio` passes seed intent and builds draft.
13. Confirm no automatic trade execution action exists.
14. Verify mobile FAB opens Prism path without duplicating desktop header entry.

## Accessibility/UX Checks

- Keyboard: run command with Enter key.
- Verify all actionable controls have visible labels.
- Ensure message log remains readable after multiple commands.

## Pass Criteria

- All checks succeed without console/runtime errors.
- Scenario changes are deterministic and reversible.
- Human decision boundary (no auto-trade) is preserved.
