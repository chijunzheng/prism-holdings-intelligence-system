# Feature: Background Signal Checker

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 02

## Description

Periodic background service that polls for new signals for all active users and creates notifications when new signals are detected. Configurable interval (default 1 minute for demo).

## Acceptance Criteria

- [ ] Tracks active users (registered on any API request, expires 24h)
- [ ] Polls every `SIGNAL_CHECK_INTERVAL_MS` (default 60000ms)
- [ ] Fires immediate check on first user activity registration
- [ ] Detects new signals by comparing against last-known set (headline hash)
- [ ] Creates notifications via NotificationService for genuinely new signals
- [ ] Uses separate 5-minute cache TTL for notification checks (not the 15min display cache)
- [ ] Gracefully handles errors (logs, doesn't crash loop)

## Implementation Details

### Files to Create

- `server/src/background-signal-checker.ts`

### Key Components

1. **BackgroundSignalChecker**
   - `activeUsers: Map<string, number>` — userId → lastActivityTimestamp
   - `lastKnownSignals: Map<string, Set<string>>` — userId → set of signal headline hashes
   - `start()` — begins interval loop
   - `stop()` — clears interval
   - `trackUser(userId)` — adds to active set, triggers immediate check if new
   - `checkAllUsers()` — iterates active users, calls checkUser for each
   - `checkUser(userId)` — runs signal pipeline, diffs against known, creates notifications
   - `computeActionUrl(signal)` — smart routing: critical/high → `/signals`, medium → `/portfolio`

### Technical Decisions

- **Reuse orchestrator pipeline** — calls `runExposureAnalysis()` + `runSignalMonitor()` from `@prism/agents/src/orchestrator`
- **Separate notification cache** — 5min TTL so background checker gets fresher signals than the 15min display cache
- **Sequential user checks** — avoid parallel to prevent Gemini API rate limits
- **Headline hash comparison** — normalize headline to lowercase, trim, hash first 50 chars for dedup

## Dependencies

### Depends On
- **Feature 02:** Creates notifications via NotificationService

### Blocks
- **Feature 04:** Server initializes this on startup

## Implementation Checklist

- [ ] Create `server/src/background-signal-checker.ts`
- [ ] Implement active user tracking with 24h expiry
- [ ] Implement signal diff detection
- [ ] Implement smart routing URL generation
- [ ] Wire into server startup

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
