# Feature: Copilot Navigate + Explain (Level 1)

**ID:** 11
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None
**Phase:** 4 — Navigating Copilot
**Plan Reference:** A9 Level 1

## Description

First level of the navigating copilot: Prism can navigate the user to a specific page and keep the drawer open with context. When Prism suggests "Show me my riskiest signal," clicking the nav chip navigates to the signal page while the drawer stays open.

Currently, `buildNavigationChips()` generates route-aware links, but clicking them closes the drawer and uses basic keyword scoring. This feature makes nav chips smarter (LLM-suggested) and keeps the drawer open across navigation.

## Acceptance Criteria

- [ ] Navigation chips keep the Ask Prism drawer open after navigation
- [ ] Drawer context transfers to the new page (scope updates)
- [ ] Navigation chips include an `autoAction: 'navigate'` flag
- [ ] Chip click calls `navigate(route)` + preserves `askPrismOpen` state
- [ ] Entry context set for the target page so Prism knows where it came from
- [ ] The conversation thread persists across the navigation (divider inserted)
- [ ] Works for: portfolio → signal, signal → plan, plan → playbook routes

## Implementation Details

### Files to Modify

- `shared/src/types/ask-prism.ts` — Extend `AskPrismNavigationChip` with `autoAction`
- `frontend/src/components/portfolio/AskPrismDrawer.tsx` — Handle navigation chip clicks
- `frontend/src/contexts/AppContext.tsx` — Ensure `askPrismOpen` persists across route changes

### Type Extension

```typescript
interface AskPrismNavigationChip {
  label: string
  to: string
  autoAction?: 'navigate'   // NEW: indicates this should navigate without closing
}
```

### AskPrismDrawer Navigation Handler

Currently, navigation chips likely render as `<Link>` or `<a>` tags that close the drawer. Change to:

```typescript
const handleNavChipClick = (chip: AskPrismNavigationChip) => {
  if (chip.autoAction === 'navigate') {
    // Navigate without closing drawer
    navigate(chip.to)
    // Set entry context for the target page
    setActiveAskPrismEntryContext({
      entryType: 'copilot_navigation',
      signalId: extractSignalIdFromRoute(chip.to),
    })
    // Insert divider in conversation
    insertDivider(`Navigated to ${chip.label}`)
  } else {
    // Default: close drawer and navigate
    onClose()
    navigate(chip.to)
  }
}
```

### AppContext Persistence

Ensure `askPrismOpen: true` is NOT cleared on route change. Currently the drawer may unmount/remount across routes — verify the drawer is rendered in a layout component above the routes (e.g., in `App.tsx` or a shared layout).

If the drawer is route-specific (rendered within each view), it needs to be lifted to a shared layout that persists across routes.

### Key Technical Decision

**Drawer placement:** If `AskPrismDrawer` is currently rendered per-view (inside PortfolioView, SignalDetailPane, etc.), it must be moved to a shared layout component (like `App.tsx` or a layout route) so it persists across navigation. This is a prerequisite for the entire copilot feature.

## Dependencies

### Blocks
- **Feature 12 (Level 2):** Navigate + highlight builds on this
- **Feature 20 (Tap-First Copilot):** Decision cards use navigation actions

## Testing Requirements

- [ ] Unit test: Nav chip with `autoAction: 'navigate'` calls navigate without closing drawer
- [ ] Unit test: Entry context updated after navigation
- [ ] Unit test: Divider inserted in conversation after navigation
- [ ] Manual: Navigate from portfolio → signal → plan with drawer staying open

## Implementation Checklist

- [ ] Extend `AskPrismNavigationChip` type with `autoAction`
- [ ] Update nav chip click handler in AskPrismDrawer
- [ ] Verify drawer persists across route changes (may need layout refactor)
- [ ] Add conversation divider on navigation
- [ ] Update entry context on navigation
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
