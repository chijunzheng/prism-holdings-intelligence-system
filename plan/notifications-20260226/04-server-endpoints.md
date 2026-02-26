# Feature: Server Endpoints (REST + SSE)

**ID:** 04
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 02, 03

## Description

Add notification REST endpoints and SSE streaming endpoint to the Express server. Initialize BackgroundSignalChecker on server startup. Track user activity on existing endpoints.

## Acceptance Criteria

- [ ] `GET /api/notifications/:userId` — returns notification list (query: `?unread=true`)
- [ ] `POST /api/notifications/:userId/:id/read` — marks one as read
- [ ] `POST /api/notifications/:userId/read-all` — marks all as read
- [ ] `GET /api/notifications/:userId/stream` — SSE endpoint with heartbeat
- [ ] BackgroundSignalChecker starts on server boot
- [ ] Existing signal/exposure endpoints call `backgroundChecker.trackUser(userId)`
- [ ] SSE connection properly handles client disconnect (cleanup subscriber)
- [ ] Vite proxy config updated to forward `/api/notifications` to server

## Implementation Details

### Files to Modify

- `server/src/index.ts` — Add endpoints, init background checker
- `frontend/vite.config.ts` — Verify proxy covers `/api/notifications` (likely already covered by `/api` prefix)

### Key Components

1. **REST Endpoints**
   - GET list: `notificationService.getAll(userId, { unread: req.query.unread === 'true' })`
   - POST read: `notificationService.markAsRead(userId, id)`
   - POST read-all: `notificationService.markAllAsRead(userId)`

2. **SSE Endpoint**
   - Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
   - Register response with `notificationService.subscribe(userId, res)`
   - Send initial `event: connected\ndata: { unreadCount }\n\n`
   - Heartbeat: `event: ping\ndata: { timestamp }\n\n` every 30s
   - On `req.on('close')`: `notificationService.unsubscribe(userId, res)`

3. **User Activity Tracking**
   - Add `backgroundChecker.trackUser(req.params.userId)` to existing:
     - `GET /api/signals/:userId`
     - `GET /api/exposure/:userId`
     - `GET /api/portfolio/:userId`

## Dependencies

### Depends On
- **Feature 02:** NotificationService
- **Feature 03:** BackgroundSignalChecker

### Blocks
- **Feature 05:** Frontend hook connects to these endpoints

## Implementation Checklist

- [ ] Add notification endpoints to `server/src/index.ts`
- [ ] Add SSE endpoint with heartbeat and cleanup
- [ ] Initialize BackgroundSignalChecker on server start
- [ ] Add `trackUser()` calls to existing endpoints
- [ ] Test with curl: `curl -N http://localhost:3001/api/notifications/sarah-01/stream`

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
