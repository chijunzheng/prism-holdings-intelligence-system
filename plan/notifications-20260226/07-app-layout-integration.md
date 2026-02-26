# Feature: AppLayout Integration + Styles

**ID:** 07
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** 06

## Description

Wire NotificationBell and NotificationPanel into AppLayout's `.app-nav__right` div. Import notification styles. Handle navigation on notification click.

## Acceptance Criteria

- [ ] Bell icon visible in nav bar (right side, before ProfileSwitcher)
- [ ] Click bell → panel opens/closes (toggle)
- [ ] Click notification → navigate to correct route + close panel + mark read
- [ ] Profile switch → reset notification state
- [ ] Panel closes on route change
- [ ] Import `notifications.css` in AppLayout

## Implementation Details

### Files to Modify

- `frontend/src/components/shared/AppLayout.tsx` — Add bell + panel + state
- `frontend/src/styles/layout.css` — Minor adjustments to `.app-nav__right` if needed

### Key Components

1. **AppLayout additions**
   - `const { userId } = useAppContext()`
   - `const notifications = useNotifications(userId)`
   - `const [panelOpen, setPanelOpen] = useState(false)`
   - Render `<NotificationBell>` in `.app-nav__right`
   - Render `<NotificationPanel>` conditionally when `panelOpen`
   - `useNavigate()` for notification click routing
   - Close panel on `location` change via `useEffect`

## Dependencies

### Depends On
- **Feature 06:** Bell and Panel components

### Blocks
- None (final feature)

## Implementation Checklist

- [ ] Add useNotifications hook to AppLayout
- [ ] Render NotificationBell in `.app-nav__right`
- [ ] Render NotificationPanel with toggle
- [ ] Handle notification click → navigate + mark read
- [ ] Import notifications.css
- [ ] Verify end-to-end: bell visible, notifications arrive, clicking works

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
