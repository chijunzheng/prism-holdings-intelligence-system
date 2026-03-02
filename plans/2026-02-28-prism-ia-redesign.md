# Prism IA Redesign (Perplexity-Inspired) — 2026-02-28

## Goals
- Reduce left-panel crowding by replacing dense sections with minimal nav.
- Keep chat as default home while moving detailed exploration to dedicated pages.
- Make holdings/signals exploration first-class while preserving traceability.

## Product Decisions
- Default route: Chat Command Center (`/`).
- Dedicated pages in v1: `Holdings` (`/holdings`) and `Signals` (`/signals`).
- Profile: lightweight sheet/modal from nav, not a full route.
- Plans: session-embedded (no dedicated Plans page in v1).
- Trace: progressive disclosure (answer first, trace/evidence expandable).
- Signal chips: remove bulky chip strip; use inline links/anchors.

## UX Direction
- Left rail: icon + label items with small counters only.
- Home: clean chat center with optional right action panel.
- Holdings page: searchable/sortable account/holding explorer.
- Signals page: feed-style cards with urgency/sentiment, source links, and analyze CTA.

## Delivery Scope
1. Routing + shell architecture.
2. Home/holdings/signals routes and layout.
3. Profile sheet and sessions drawer entry points.
4. Remove bulky chat follow-up chip UI.
5. Tests and verification.
