# Canvas Maximize + Fit Visibility

## Intent
Improve graph readability across the app by making each canvas easier to inspect and removing wasted space.

## Scope
- Shared `CausalGraph` component behavior and styling.
- No backend/API changes.

## Changes
1. Improve fit-to-content defaults so nodes occupy more of the visible graph area.
2. Add a visible `Maximize` control for canvases and a fullscreen canvas mode with `Escape` support.
3. Remove inner graph outline to avoid double-borders against section cards.
4. Keep reset behavior intact and ensure controls remain accessible while maximized.

## Verification
- Run frontend tests and a frontend build check.
- Manual diff review for all files using `CausalGraph`.
