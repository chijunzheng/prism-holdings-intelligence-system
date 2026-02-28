# Feature: Ask Prism Entry Wiring + Route Rendering Fix

**ID:** 01
**Status:** ✅ Completed
**Priority:** High
**Dependencies:** -

## Description
Ensure every "Discuss with Prism" and "Ask Prism" action can open a mounted Ask Prism drawer and pass actionable entry context.

## Acceptance Criteria
- [x] `setAskPrismOpen(true)` from `/signals` routes always shows drawer.
- [x] Contextual actions can pass node/signal/full-canvas entry metadata.
- [x] Contextual actions can auto-send a scoped first prompt.
