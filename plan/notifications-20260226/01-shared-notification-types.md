# Feature: Shared Notification Types

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** None

## Description

Create shared Zod-validated TypeScript types for notifications, used by both server and frontend.

## Acceptance Criteria

- [ ] `Notification` Zod schema with all required fields
- [ ] `NotificationType` enum: `new_signal`, `signal_update`, `concentration_alert`
- [ ] Exported from `@prism/shared`
- [ ] Types reuse existing `SignalUrgency` from signal.ts

## Implementation Details

### Files to Create/Modify

- `shared/src/types/notification.ts` — New Zod schemas
- `shared/src/index.ts` — Add export

### Key Components

1. **NotificationSchema**
   - `id: string` (UUID)
   - `userId: string`
   - `type: NotificationType`
   - `signalId?: string` (links to originating signal)
   - `headline: string`
   - `description: string`
   - `urgency: SignalUrgency` (reuse from signal.ts)
   - `createdAt: string` (ISO datetime)
   - `read: boolean`
   - `dismissed: boolean`
   - `actionUrl?: string` (smart routing target)

## Dependencies

### Depends On
- None

### Blocks
- **Feature 02:** NotificationService needs these types

## Implementation Checklist

- [ ] Create `shared/src/types/notification.ts`
- [ ] Export from `shared/src/index.ts`
- [ ] Verify build: `pnpm build --filter @prism/shared`

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
