# Proactive Notification System

## Context

Prism's intelligence is currently passive — signals only appear when users visit the Portfolio page. To differentiate, we need a **proactive notification system** that alerts users in real-time when market events impact their portfolio. This creates the feeling of a continuously-monitoring AI advisor.

Key challenge: **cadence balance**. Too frequent = fatigue/noise. Too rare = unimpressive for demo.

## Cadence Strategy

### Recommended: Tiered Urgency with Background Polling

**Server polls every 3 minutes** for all active users (visited in last 24h). Notifications are gated by urgency tier:

| Tier | Criteria | Delivery | Max Frequency |
|------|----------|----------|---------------|
| Critical | `urgency: 'critical'` AND `relevance >= 0.8` | Immediate toast + bell badge | 1/hour |
| High | `urgency: 'high'` OR `relevance >= 0.6` | Bell badge + toast on next interaction | 3/day |
| Medium | Everything else with `relevance >= 0.4` | Bell badge only (silent) | 10/day |

**Default: 1 minute polling** (configurable via `SIGNAL_CHECK_INTERVAL_MS` env var). For a 3-minute demo, this guarantees 2-3 notification arrivals during the recording. Server cache (15min TTL) means most checks are cheap cache hits — only the first check per 15min window calls Gemini.

**Demo-optimized flow:**
1. App loads → immediate background check fires (no waiting for first interval)
2. ~15-30s: First notification arrives via SSE → bell badge animates (1)
3. ~60s: Second check finds additional signal → badge increments (2)
4. User clicks bell → panel shows both, clicks one → causal graph deep dive
5. ~120s: Third notification arrives while user is on another page — proves continuous monitoring

**Signal cache TTL for notifications:** Reduced to 5 minutes (separate from the 15min display cache) so the background checker actually gets fresh signals more often during a demo.

## Architecture

### Backend: 2 New Files + Endpoint Changes

**1. `server/src/notification-service.ts`** — In-memory notification store
- `Notification` type: `{ id, userId, type, signalId?, headline, description, urgency, createdAt, read, dismissed }`
- Types: `'new_signal' | 'signal_update' | 'concentration_alert'`
- Per-user `Map<userId, Notification[]>` — 24h TTL, max 50/user
- Frequency cap enforcement (sliding window per urgency tier)
- SSE subscriber management: `Map<userId, Set<Response>>` for push

**2. `server/src/background-signal-checker.ts`** — Periodic polling
- Tracks active users (set on any API request, expires after 24h)
- Every 1 minute (configurable): `runSignalMonitor()` for each active user
- Compares new signals against last-known set (by headline hash)
- New signals → `NotificationService.create()` → SSE push
- Reuses existing orchestrator cache (most checks = cache hits)

**3. New endpoints in `server/src/index.ts`:**
- `GET /api/notifications/:userId` — list (query: `?unread=true`)
- `POST /api/notifications/:userId/:id/read` — mark one read
- `POST /api/notifications/:userId/read-all` — mark all read
- `GET /api/notifications/:userId/stream` — SSE push endpoint

### Frontend: 4 New Files + Layout Change

**1. `frontend/src/hooks/useNotifications.ts`**
- Fetches initial notifications on mount
- Opens SSE to `/api/notifications/:userId/stream`
- Reconnects with exponential backoff (1s → 2s → 4s → max 30s)
- Returns: `{ notifications, unreadCount, markAsRead, markAllAsRead, dismiss }`

**2. `frontend/src/components/notifications/NotificationBell.tsx`**
- Inline SVG bell (stroke-based, matching ProfileSwitcher icon style)
- Red badge with count (max "9+"), pulse animation on increment
- Lives in `.app-nav__right` div (currently empty)

**3. `frontend/src/components/notifications/NotificationPanel.tsx`**
- Dropdown below bell, right-aligned, 360px wide, max-height 400px
- Header: "Notifications" + "Mark all read"
- Scrollable NotificationItem list
- Empty state: "All caught up. We're monitoring your portfolio."
- Click outside to close

**4. `frontend/src/components/notifications/NotificationItem.tsx`**
- Left border colored by urgency (red=critical, orange=high)
- Blue unread dot + bold headline when unread
- 2-line description clamp, relative timestamp
- Click → **smart routing**: Critical/High → `/signals` (causal graph deep dive), Medium → `/portfolio` (scroll to signal cards). This showcases Prism's unique causal reasoning for important events.

### New Shared Types

**`shared/src/types/notification.ts`** — Zod schema for `Notification`

### Modified Files

- **`frontend/src/components/shared/AppLayout.tsx`** — Bell + Panel in `.app-nav__right`
- **`frontend/src/styles/notifications.css`** (new) — All notification styles
- **`server/src/index.ts`** — Endpoints + background checker init + user activity tracking

## Implementation Order

1. Shared types (`notification.ts`)
2. NotificationService (in-memory store + SSE)
3. BackgroundSignalChecker (polling + diff detection)
4. Server endpoints (REST + SSE)
5. `useNotifications` hook (SSE client + state)
6. NotificationBell (icon + badge)
7. NotificationPanel + NotificationItem (dropdown UI)
8. AppLayout integration (wire into nav)
9. `notifications.css` (styles)

## Verification

- `pnpm dev` — bell icon visible in nav bar
- Wait ~3 minutes — bell badge appears with count
- Click bell — panel opens with notification list
- Click notification — navigates to signals, marked read
- Switch profiles — notifications clear/reload for new user
- Existing signal cards on Portfolio View unchanged
