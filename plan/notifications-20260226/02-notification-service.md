# Feature: Notification Service

**ID:** 02
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 01

## Description

In-memory notification store with SSE subscriber management. Core backend service that creates, stores, and pushes notifications to connected clients.

## Acceptance Criteria

- [ ] Create/store notifications per user (max 50, 24h TTL)
- [ ] Frequency cap enforcement per urgency tier (critical: 1/hr, high: 3/day, medium: 10/day)
- [ ] SSE subscriber management (register/unregister Response objects)
- [ ] Push new notifications to all SSE subscribers for that user
- [ ] Mark read / mark all read / dismiss operations
- [ ] Cleanup stale notifications on interval

## Implementation Details

### Files to Create

- `server/src/notification-service.ts`

### Key Components

1. **NotificationService (singleton)**
   - `notifications: Map<string, Notification[]>` — per-user store
   - `subscribers: Map<string, Set<Response>>` — SSE connections
   - `frequencyCounts: Map<string, { critical: WindowCounter, high: WindowCounter, medium: WindowCounter }>`
   - `create(userId, data)` → creates notification, checks frequency cap, pushes via SSE
   - `getAll(userId, filters?)` → returns notifications (optionally unread only)
   - `getUnreadCount(userId)` → number
   - `markAsRead(userId, notificationId)` → void
   - `markAllAsRead(userId)` → void
   - `dismiss(userId, notificationId)` → void
   - `subscribe(userId, res)` / `unsubscribe(userId, res)` → SSE management
   - `cleanup()` → remove expired notifications (called every 10min)

### Technical Decisions

- **Singleton pattern** — single instance shared across server
- **Immutable updates** — create new arrays when modifying notifications
- **SSE format** — `event: notification\ndata: {json}\n\n` with 30s heartbeat pings

## Dependencies

### Depends On
- **Feature 01:** Notification types

### Blocks
- **Feature 03:** Background checker creates notifications via this service
- **Feature 04:** Server endpoints expose this service

## Implementation Checklist

- [ ] Create `server/src/notification-service.ts`
- [ ] Implement all CRUD operations
- [ ] Implement frequency cap logic
- [ ] Implement SSE subscriber management
- [ ] Verify: import and instantiate in server

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
