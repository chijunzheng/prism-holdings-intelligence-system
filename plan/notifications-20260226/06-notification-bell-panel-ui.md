# Feature: Notification Bell + Panel UI

**ID:** 06
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 05

## Description

Three React components: NotificationBell (icon + badge), NotificationPanel (dropdown), and NotificationItem (individual row). Wealthsimple-style design with clean typography, subtle animations.

## Acceptance Criteria

- [ ] Bell icon with red unread badge (max "9+")
- [ ] Badge pulse animation when count increases
- [ ] Panel dropdown: 360px wide, right-aligned, max 400px scrollable
- [ ] Panel header: "Notifications" title + "Mark all read" button
- [ ] Items: urgency left border, unread dot, headline, description (2-line clamp), relative timestamp
- [ ] Click item → smart routing (critical/high → `/signals`, medium → `/portfolio`) + mark read
- [ ] Click outside panel → close
- [ ] Empty state: "All caught up. We're monitoring your portfolio."
- [ ] Accessible: aria-labels, keyboard nav, focus management

## Implementation Details

### Files to Create

- `frontend/src/components/notifications/NotificationBell.tsx`
- `frontend/src/components/notifications/NotificationPanel.tsx`
- `frontend/src/components/notifications/NotificationItem.tsx`
- `frontend/src/styles/notifications.css`

### Key Components

1. **NotificationBell** — `{ unreadCount, onClick }` props
   - Inline SVG bell (stroke-based, 20x20, matching ProfileSwitcher)
   - `position: relative` container for badge positioning
   - Badge: absolute top-right, 16px circle, `var(--color-negative)` background

2. **NotificationPanel** — `{ notifications, onMarkAllRead, onItemClick, onDismiss, onClose }`
   - Uses `useRef` + `useEffect` for click-outside detection
   - Sorted by createdAt descending (newest first)
   - Footer: "Last checked: X min ago"

3. **NotificationItem** — `{ notification, onClick, onDismiss }`
   - Left border: red (critical), orange (high), transparent (medium)
   - Unread: blue dot + font-weight 600 headline
   - Relative time util: "just now", "3 min ago", "2 hours ago"
   - Dismiss X button visible on hover

### Technical Decisions

- **Inline SVG** — no icon library dependency (consistent with codebase)
- **CSS-only animations** — pulse, fade-in, badge appear
- **Click outside** — `mousedown` event on document, check if target is within panel ref

## Dependencies

### Depends On
- **Feature 05:** useNotifications hook provides data and mutations

### Blocks
- **Feature 07:** AppLayout wires these components into nav

## Implementation Checklist

- [ ] Create NotificationBell.tsx
- [ ] Create NotificationPanel.tsx
- [ ] Create NotificationItem.tsx
- [ ] Create notifications.css
- [ ] Add relative time formatting utility

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
