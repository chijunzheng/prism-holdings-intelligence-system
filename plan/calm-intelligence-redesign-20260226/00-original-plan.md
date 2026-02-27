# Original Plan: Calm Intelligence UI Redesign

## Vision
Replace the busy IDE-style Impact Analysis / Unified Workspace with two clean, scrollable pages (Signal Detail + Plan) that follow the same main-content + sidebar layout as the existing Portfolio page. Unify Ask Prism's context model so chat is fully aware on every screen. Delete all workspace/IDE complexity.

## Architecture Overview

```
Portfolio (kept)  →  Signal Detail (new)  →  Plan (new)
     │                     │                     │
     └─── Ask Prism ───────┴─────────────────────┘
          (unified context, slide-over on all screens)
```

**Navigation:** Linear breadcrumb flow. Portfolio → Signal Detail (via signal card "View analysis →") → Plan (via "Build a plan" button). Back navigation at each level.

**Layout pattern:** Every screen uses ~65% main content + ~35% right sidebar. Sidebar always shows "the numbers," main area shows "the story."

## Design Principles

1. **One thing at a time.** Never show 3 columns simultaneously. Depth through drilling in, not spreading out.
2. **Wealthsimple's visual DNA.** Generous whitespace, system font stack, muted grays with one accent color, card surfaces with subtle borders (no shadows), large readable type.
3. **Intelligence pulls you in.** The system surfaces what matters; the user chooses to go deeper. No command lines, no branches, no "workspaces."
4. **Every screen answers one question.** Portfolio: "Am I okay?" Signal: "What's happening?" Plan: "What can I do?"

## Layout Pattern: Main + Sidebar, Everywhere

| Screen | Main Content (left ~65%) | Sidebar (right ~35%) |
|---|---|---|
| **Portfolio** | Holdings list, signal cards, exposure chart | Signal Exposure, Hidden Overlaps, Risk Radar |
| **Signal Detail** | Story + causal graph + evidence | Impact summary, temporal, counterfactual |
| **Plan** | Candidate cards (add/remove) | Live evaluation, constraints, before/after |

## Dependency Graph

```
Phase 1 (Backend Chat)     Phase 4 (Graph Guardrails)
         │                          │
         ▼                          ▼
Phase 2 (Signal Detail) ◄──────────┘
         │
         ▼
Phase 3 (Plan Page)
         │
         ▼
Phase 5 (Ask Prism Upgrade)
         │
         ▼
Phase 6 (Cleanup)
```

Phases 1 and 4 can run in parallel. Everything else is sequential.

## What Gets Deleted

- `UnifiedWorkspaceView` and all workspace session UI
- Strategy Studio 3-column layout (`StrategyStudioLayout.tsx`)
- `StrategyCommandPanel.tsx` (command console)
- Workspace session endpoints (backend)
- Branch/checkpoint UI components
- `ImpactAnalysisView.tsx` and drilldown/overview tabs

## What Gets Kept

- Portfolio page (as-is)
- All backend agents and services
- Ask Prism slide-over (upgraded)
- `CausalGraph.tsx` (refactored with guardrails)
- All server data/pipeline endpoints
