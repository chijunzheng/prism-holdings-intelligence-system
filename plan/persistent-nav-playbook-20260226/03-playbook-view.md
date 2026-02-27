# Feature: Playbook View

**ID:** 03
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 01

## Description

View showing saved plan sessions as cards with evaluation summaries. Users can click to resume/review plans. Fetches from the plan session endpoints created in Feature 01.

## Acceptance Criteria

- [ ] `/playbook` shows saved plan sessions as cards
- [ ] Each card shows: title, signal headline, affected exposure tags, evaluation metrics (downside reduction, turnover, selections count), status badge, date
- [ ] Click card navigates to `/signals/:signalId/plan?sessionId=xxx`
- [ ] Empty state: "No saved plans yet. Build a plan from any signal."
- [ ] Loading and error states work correctly

## Implementation Details

### Files to Create

- `frontend/src/routes/PlaybookView.tsx` — route component
- `frontend/src/styles/playbook.css` — card layout styles

### Key Components

1. **`PlaybookView.tsx`**
   - Fetches `GET /api/plans/:userId` on mount
   - Renders plan session cards with metadata
   - Click handler navigates to plan page with `?sessionId=` query param
   - Status badges: draft (yellow), reviewed (green), archived (gray)
   - Evaluation summary: downside reduction, turnover %, selection count

2. **`playbook.css`**
   - Card layout with hover states
   - Metric grid (3 columns)
   - Status badge colors
   - Exposure tags

### Technical Decisions

- **Session ID in URL:** Playbook passes sessionId as query param so PlanView can restore state.
- **No inline editing:** Cards are read-only summaries. Click to open full plan view.

## Dependencies

### Depends On
- **Feature 01:** Plan session endpoints must exist

### Blocks
- **Feature 04:** Navigation needs this view before routing to it
- **Feature 05:** Auto-save needs Playbook to exist for the navigation flow

## Testing Requirements

- [ ] Component renders with mock sessions
- [ ] Empty state displays when no sessions
- [ ] Card click navigates with correct sessionId

## Security Considerations

- [ ] Only show sessions for current userId

## Implementation Checklist

- [ ] Create PlaybookView.tsx
- [ ] Create playbook.css
- [ ] Verify build compiles

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
