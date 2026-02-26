# Feature: useNotifications Hook (SSE Client)

**ID:** 05
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 04

## Description

React hook that manages notification state, SSE connection, and mutation functions. Provides everything the UI components need.

## Acceptance Criteria

- [ ] Fetches initial notifications on mount
- [ ] Opens SSE connection to `/api/notifications/:userId/stream`
- [ ] Reconnects with exponential backoff (1s → 2s → 4s → max 30s)
- [ ] Appends new notifications from SSE events immutably
- [ ] Provides `markAsRead`, `markAllAsRead`, `dismiss` with optimistic updates
- [ ] Cleans up SSE connection on unmount or userId change
- [ ] Tracks `connected` status for UI indicator

## Implementation Details

### Files to Create

- `frontend/src/hooks/useNotifications.ts`

### Key Components

1. **useNotifications(userId: string)**
   - State: `{ notifications, unreadCount, loading, connected }`
   - On mount: `fetch('/api/notifications/${userId}')` → set initial state
   - SSE: `new EventSource('/api/notifications/${userId}/stream')`
   - `onmessage` handler: parse notification event → prepend to list, increment count
   - `onerror` handler: set connected=false, schedule reconnect with backoff
   - Mutations: POST to server → optimistic local update → revert on error
   - Cleanup: `eventSource.close()` on unmount

### Technical Decisions

- **Optimistic updates** — UI responds immediately, reverts on server error
- **Immutable state** — all updates create new arrays/objects
- **EventSource API** — native browser SSE support, simpler than WebSocket
- **No context provider needed** — hook used directly in AppLayout (single consumer)

## Dependencies

### Depends On
- **Feature 04:** Server endpoints

### Blocks
- **Feature 06:** UI components consume this hook

## Implementation Checklist

- [ ] Create `frontend/src/hooks/useNotifications.ts`
- [ ] Implement SSE connection with reconnection
- [ ] Implement optimistic mutation functions
- [ ] Verify: hook returns data when server is running

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
