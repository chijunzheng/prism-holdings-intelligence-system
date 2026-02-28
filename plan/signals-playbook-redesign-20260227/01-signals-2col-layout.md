# Feature: Signals 2-Column Layout + Chip Strip

**ID:** 01
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Replace the current 3-column signals workspace (280px list | 1fr center | 320px sidebar) with a Wealthsimple-style 2-column layout (1fr main | 340px sidebar). The signal list panel becomes a horizontal chip strip at the top of the main column.

## Acceptance Criteria

- [ ] Signals workspace uses 2-column grid: wide main + 340px sidebar
- [ ] Horizontal signal chip strip at top of main column with "All" + per-signal chips
- [ ] Clicking a chip navigates to that signal, chip highlights as active
- [ ] "All" chip returns to `/signals` combined view
- [ ] Overflow signals show "+N more" indicator
- [ ] Generous Wealthsimple spacing: 14px radius cards, `--shadow-card`, warm gray bg
- [ ] SignalListPanel and SignalListItem deleted

## Implementation Details

### Files to Modify

- `frontend/src/routes/signals/SignalsLayout.tsx` — Change from 3-col grid to 2-col. Remove SignalListPanel import. Wrap Outlet in new 2-col structure.
- `frontend/src/styles/signals-workspace.css` — Rewrite: 2-col grid, chip strip styles, remove all 3-col + left panel styles.

### Files to Create

- `frontend/src/components/signal/SignalChipStrip.tsx` — Horizontal scrollable chip strip with "All" + per-signal chips + overflow indicator.

### Files to Delete

- `frontend/src/components/signal/SignalListPanel.tsx`
- `frontend/src/components/signal/SignalListItem.tsx`

### Key Components

1. **SignalChipStrip** — horizontal flex row with overflow-x auto. Each chip: urgency dot color + truncated headline (max ~20 chars). Active chip has `--color-text` bg with white text. "All" chip at the start.

2. **SignalsLayout** — 2-col grid: `grid-template-columns: 1fr 340px`. Padding + gap for breathing room. Outlet renders in main column.

## Testing Requirements

- [ ] Build passes (`pnpm build`)
- [ ] `/signals` route renders 2-col layout
- [ ] Chip strip shows all signals + "All" chip

## Implementation Checklist

- [ ] Create `SignalChipStrip.tsx`
- [ ] Rewrite `SignalsLayout.tsx` for 2-col
- [ ] Rewrite `signals-workspace.css`
- [ ] Delete `SignalListPanel.tsx` and `SignalListItem.tsx`
- [ ] Verify build passes

---

**Created:** 2026-02-27
