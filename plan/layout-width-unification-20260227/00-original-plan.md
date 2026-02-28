# Wealthsimple Layout Width Unification

## Goal

Unify Portfolio, Signals, Playbook, and Plan pages under the same shell width and right-rail proportions, matching Wealthsimple's calm, card-stack layout.

## Problems

- Signals page right rail appears as a full-height slab instead of discrete cards.
- Different page shells use different `max-width` and side-rail widths.
- Spacing/gaps are inconsistent across primary navigation pages.

## Scope

1. Introduce shared layout shell tokens (max width, sidebar width, horizontal padding).
2. Apply tokens to Portfolio, Signals workspace, Playbook, and Plan.
3. Convert Signals right rail to transparent card-stack container.
4. Keep responsive behavior intact.

## Out of Scope

- Data model/API changes.
- Functional changes to signal/plan logic.
