# Feature: Routing Update & Old View Cleanup

**ID:** 06
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 02, 03, 05

## Description

Update routing to the new page structure and delete all workspace/IDE components and unused views. This is the final feature — only executed after all new pages and the chat upgrade are working.

## Acceptance Criteria

- [ ] `/signals/:signalId` routes to new Signal Detail page
- [ ] `/signals/:signalId/plan` routes to new Plan page
- [ ] `/signals` redirects to Portfolio (no standalone signals list)
- [ ] `/signals/workspace` and `/signals/legacy` routes are removed
- [ ] Signal card "View analysis →" on Portfolio links to `/signals/:signalId`
- [ ] Old `ImpactAnalysisView`, `UnifiedWorkspaceView`, Strategy Studio components are deleted
- [ ] Old workspace session endpoints are removed from server routes
- [ ] Old general/scoped chat endpoints are deprecated (removed or commented)
- [ ] App compiles with no unused import warnings
- [ ] No orphaned CSS files
- [ ] No dead routes that 404

## Implementation Details

### Files to Delete

**Frontend components:**
- `frontend/src/routes/impact/ImpactAnalysisView.tsx` (and any sub-views: overview, drilldown tabs)
- `frontend/src/routes/impact/UnifiedWorkspaceView.tsx`
- `frontend/src/components/strategy/StrategyStudioLayout.tsx`
- `frontend/src/components/strategy/StrategyCommandPanel.tsx`
- `frontend/src/components/strategy/ScenarioCanvas.tsx`
- Any workspace session UI components/hooks
- Associated CSS files for deleted components

**Check before deleting** — some strategy components may be reusable:
- `frontend/src/components/strategy/CandidateRail.tsx` — might inform CandidateCard, but likely different enough to not reuse
- `frontend/src/components/strategy/StrategyEvaluationPanel.tsx` — sidebar replaces this

### Files to Modify

- `frontend/src/App.tsx` — remove old routes, add redirects
- `frontend/src/components/portfolio/SignalCard.tsx` — update navigation target
- `server/src/index.ts` — remove/comment workspace session endpoints, remove old chat endpoints

### Server Endpoints to Remove

```
# Workspace sessions (all of these)
GET/POST  /api/workspace/:userId/sessions
GET       /api/workspace/:userId/sessions/:sessionId
PATCH     /api/workspace/:userId/sessions/:sessionId
POST/PATCH /api/workspace/:userId/sessions/:sessionId/branches
POST      /api/workspace/:userId/sessions/:sessionId/checkpoints
POST      /api/workspace/:userId/sessions/:sessionId/restore/:checkpointId
POST      /api/workspace/:userId/sessions/:sessionId/compare
POST      /api/workspace/:userId/sessions/:sessionId/operations

# Old chat endpoints (replaced by /api/chat/:userId/ask-prism)
POST      /api/chat/:userId/general/init
POST      /api/chat/:userId/general/message
```

**Keep:**
- `POST /api/chat/:userId/init` — still used by node-scoped bottom sheet chat
- `POST /api/chat/:userId/message` — still used by node-scoped bottom sheet chat
- All pipeline endpoints (signals, graph, exposure, strategy)

### Routing Changes

```typescript
// Before
'/signals' → ImpactAnalysisView (or UnifiedWorkspaceView if feature flag)
'/signals/legacy' → legacy ImpactAnalysisView
'/signals/workspace' → UnifiedWorkspaceView

// After
'/signals' → redirect to '/portfolio'
'/signals/:signalId' → SignalDetailView (new)
'/signals/:signalId/plan' → PlanView (new)
```

### Technical Decisions

- **Delete, don't comment out:** Old components are fully replaced. No reason to keep dead code.
- **Keep node-scoped chat endpoints:** The bottom sheet on Signal Detail uses these for node-specific context. They're still needed.
- **Remove feature flag:** `UNIFIED_WORKSPACE_ENABLED` env var is no longer needed. Delete references.

## Dependencies

### Depends On
- **Feature 02:** Signal Detail Page must be working
- **Feature 03:** Plan Page must be working
- **Feature 05:** Ask Prism frontend must be wired to new endpoint

### Blocks
- Nothing — this is the final feature

## Testing Requirements

- [ ] E2E test: full flow Portfolio → Signal Detail → Plan → back navigation
- [ ] E2E test: Ask Prism works on all 3 pages
- [ ] Verify: no 404s on any navigation path
- [ ] Verify: app compiles cleanly after deletion
- [ ] Verify: no console errors from missing imports

## Security Considerations

- [ ] Ensure removed endpoints can't still be called (404, not hanging)
- [ ] Verify no sensitive data was in deleted workspace session service

## Implementation Checklist

- [ ] Update routes in App.tsx
- [ ] Update signal card navigation links
- [ ] Delete old view components
- [ ] Delete old strategy studio components
- [ ] Delete workspace session UI hooks/components
- [ ] Remove workspace session server endpoints
- [ ] Remove old general chat server endpoints
- [ ] Remove feature flag references
- [ ] Clean up unused imports across all files
- [ ] Delete orphaned CSS files
- [ ] Run build to verify no compile errors
- [ ] Run existing tests to verify no regressions
- [ ] Manual smoke test: full navigation flow

## Notes

- `server/src/index.ts` is currently 1100+ lines (monolithic). This cleanup is a good opportunity to verify no dead code, but don't refactor the file structure — that's a separate task.
- `server/src/workspace-session-service.ts` can be deleted entirely.
- Keep `server/src/strategy-service.ts` — it's used by the Plan page endpoints.
- Keep `server/src/notification-service.ts` — notifications are still used on Portfolio page.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
**Implemented By:** —
