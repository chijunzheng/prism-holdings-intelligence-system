# Feature: Codebase Cleanup

**ID:** 03
**Status:** 🔄 In Progress
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** None
**Tier:** 0

## Description

Delete dead code from old multi-page UI and refactor large files. The entire old UI is being replaced by a single chat interface, so most frontend routes, components, hooks, and styles can be removed. Also delete dead server services and the ADK directory.

## Acceptance Criteria

- [ ] All dead frontend routes deleted (PortfolioView, PlaybookView, PlanView, signals/, impact/, UnifiedWorkspace, ImpactAnalysis)
- [ ] Dead component directories deleted (graph/, impact/, notifications/, plan/, signal/, strategy/, and most of portfolio/)
- [ ] Dead hooks deleted (usePlan, useWorkspaceSessions, useWorkspaceAutosave, useGraphExpansion, useStrategyDraft, useScenarioEvaluation, usePageContext, useGraphLayout, useNotifications)
- [ ] Dead CSS files deleted
- [ ] Dead server services deleted (workspace-session, plan-session, plan-copilot, notification)
- [ ] Dead shared types deleted (workspace.ts, plan-session.ts, notification.ts)
- [ ] ADK directory deleted (`agents/src/adk/`)
- [ ] `server/src/index.ts` refactored into route modules (~1596 → ~500 lines)
- [ ] `agents/src/orchestrator/index.ts` refactored (897 → ~400 lines)
- [ ] Dead chat agent functions removed (generateInitialMessage, streamChatResponse, generateGeneralInitialMessage, streamGeneralChatResponse)
- [ ] `App.tsx` updated to single chat route
- [ ] `feature-flags.ts` deleted
- [ ] `pnpm build` succeeds with 0 errors after all changes

## Files to Delete

### Frontend Routes
- `frontend/src/routes/PortfolioView.tsx`
- `frontend/src/routes/PlaybookView.tsx`
- `frontend/src/routes/UnifiedWorkspaceView.tsx`
- `frontend/src/routes/ImpactAnalysisView.tsx`
- `frontend/src/routes/signal/PlanView.tsx`
- `frontend/src/routes/signals/CombinedSignalsPane.tsx`
- `frontend/src/routes/signals/SignalDetailPane.tsx`
- `frontend/src/routes/signals/SignalsLayout.tsx`
- `frontend/src/routes/impact/ImpactDrilldownView.tsx`
- `frontend/src/routes/impact/ImpactOverviewView.tsx`
- `frontend/src/routes/impact/StrategyStudioView.tsx`
- `frontend/src/routes/impact/types.ts`

### Frontend Components (entire directories)
- `frontend/src/components/graph/` (all files)
- `frontend/src/components/impact/` (all files)
- `frontend/src/components/notifications/` (all files)
- `frontend/src/components/plan/` (all files)
- `frontend/src/components/signal/` (all files)
- `frontend/src/components/strategy/` (all files)
- Most of `frontend/src/components/portfolio/` EXCEPT: `AskPrismDrawer.tsx`, `ask-prism-drawer-utils.ts`, `ExposurePieChart.tsx`, `ConcentrationWarning.tsx`

### Frontend Hooks
- `frontend/src/hooks/usePlan.ts`
- `frontend/src/hooks/useWorkspaceSessions.ts`
- `frontend/src/hooks/useWorkspaceAutosave.ts`
- `frontend/src/hooks/useGraphExpansion.ts`
- `frontend/src/hooks/useStrategyDraft.ts`
- `frontend/src/hooks/useScenarioEvaluation.ts`
- `frontend/src/hooks/usePageContext.ts`
- `frontend/src/hooks/useGraphLayout.ts`
- `frontend/src/hooks/useNotifications.ts`

### Frontend Styles (dead CSS)
- `frontend/src/styles/portfolio.css`
- `frontend/src/styles/signals-workspace.css`
- `frontend/src/styles/impact-analysis.css`
- `frontend/src/styles/plan.css`
- `frontend/src/styles/strategy-studio.css`
- `frontend/src/styles/playbook.css`
- `frontend/src/styles/signal-detail.css`
- `frontend/src/styles/graph.css`
- `frontend/src/styles/notifications.css`
- `frontend/src/styles/signal-cards.css`
- `frontend/src/styles/workspace.css`
- `frontend/src/styles/holdings-drawer.css`
- `frontend/src/styles/signals.css`
- `frontend/src/styles/layout.css`

### Frontend Utils
- `frontend/src/utils/feature-flags.ts`
- `frontend/src/types/workspace.ts`

### Server
- `server/src/workspace-session-service.ts`
- `server/src/plan-session-service.ts`
- `server/src/plan-copilot-service.ts`
- `server/src/notification-service.ts`
- Related test files in `server/src/__tests__/`

### Shared Types
- `shared/src/types/workspace.ts`
- `shared/src/types/plan-session.ts`
- `shared/src/types/notification.ts`

### Agents
- `agents/src/adk/` (entire directory)

## Files to Refactor

### server/src/index.ts (1596 → ~500 lines)
Extract into route modules:
- `server/src/routes/signals.ts`
- `server/src/routes/graph.ts`
- `server/src/routes/chat.ts`
- `server/src/routes/portfolio.ts`
- `server/src/routes/strategy.ts`

### agents/src/orchestrator/index.ts (897 → ~400 lines)
Extract:
- `agents/src/orchestrator/net-impact.ts` (runPortfolioNetImpactPipeline)
- `agents/src/orchestrator/cache.ts` (cache logic)

### agents/src/chat-agent/index.ts
Remove dead functions: `generateInitialMessage`, `streamChatResponse`, `generateGeneralInitialMessage`, `streamGeneralChatResponse`

### frontend/src/App.tsx
Replace all routes with single `<ChatView />` route (placeholder component until Feature 15)

## Implementation Strategy

1. Start with deletions (files that are clearly dead)
2. Update imports in remaining files
3. Refactor large files into modules
4. Update App.tsx router
5. Run `pnpm build` and fix any broken imports
6. Verify remaining functionality still works

## Implementation Checklist

- [ ] Delete dead frontend files
- [ ] Delete dead server files
- [ ] Delete dead shared types
- [ ] Delete ADK directory
- [ ] Refactor server/src/index.ts into route modules
- [ ] Refactor orchestrator/index.ts
- [ ] Clean up chat-agent/index.ts
- [ ] Update App.tsx to single route
- [ ] Fix all broken imports
- [ ] Verify pnpm build succeeds
