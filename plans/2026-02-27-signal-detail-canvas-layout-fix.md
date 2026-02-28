# Signal Detail Canvas Layout Fix

## Intent
Fix Signal Detail visual structure so the causal map is larger, cleaner, and separated from node explanation content.

## Scope
- Signal detail page layout and styling.
- No backend/API changes.

## Changes
1. Remove giant single white container on Signal Detail.
2. Split into distinct panels: header/tabs, graph canvas, node explanation card.
3. Increase graph canvas height on Signal Detail.
4. Expand node explanation into a richer detail card (impact, confidence, role, explanation).

## Verification
- Run tests and frontend build check.
- Manual diff review for Signal Detail component and workspace styles.
