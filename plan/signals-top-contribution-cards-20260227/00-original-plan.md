# Signals Top Contribution Cards

## Goal

Make `/signals` (All tab) start with a clear "which signals matter most" view.

## Requirement

- Put signal contributions at the top of the page.
- Use richer signal cards (not just headline text) with enough context to decide what to open.

## Scope

1. Add top contribution cards section sorted by absolute 1M impact.
2. Each card includes:
   - signal headline
   - direction + 1M contribution
   - normalized weight
   - short portfolio impact text (when available)
   - CTA to open signal detail
3. Keep deeper sections (graph/table) below.

## Out of Scope

- Backend/API changes.
- Signal scoring model changes.
