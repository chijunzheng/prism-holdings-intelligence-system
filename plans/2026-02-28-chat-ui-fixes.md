# Plan: Chat UI Cleanup (Sidebar + Typography)

## Goal
Fix major chat landing UI inconsistencies visible in the current shell layout.

## Scope
1. Remove the collapsed mini-rail when the left explorer drawer is expanded by default.
2. Align top-left drawer "Prism" typography with center welcome "Prism" style.
3. Audit the screen for additional UI issues and document them for follow-up.

## Constraints
- Do not start a dev server.
- Keep changes limited to chat shell and chat view styling.

## Verification
- Type check frontend package.
- Run targeted code review pass on changed files.

## Deliverables
- Updated shell render logic for rail visibility.
- Updated chat view typography styles.
- Concise issue inventory with severity.
