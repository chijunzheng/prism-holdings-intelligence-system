# Feature: Hybrid Session Scope Management

**ID:** 03
**Status:** ✅ Completed
**Priority:** High
**Dependencies:** 01, 02

## Description
Use scoped Ask Prism sessions so users get continuity where needed without mixing unrelated conversations.

## Acceptance Criteria
- [x] Ask Prism API accepts/derives session scope (`global`, `signal`, `node`).
- [x] ADK session IDs include scope so global/signal/node threads are separated.
- [x] Frontend caches messages by scope rather than a single per-user thread.
