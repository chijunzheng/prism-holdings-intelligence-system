# Feature: Project Scaffolding & Core Infrastructure

**ID:** 01
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** None

## Description

Set up the monorepo structure, React frontend with TypeScript, Google ADK agent framework, build tooling, and shared type definitions that all other features build on. This is the foundation — every subsequent feature depends on it.

## Why This Matters

Architectural decisions made here (project structure, type system, agent framework wiring) propagate through every feature. Getting the shared types right — especially the causal chain JSON schema — prevents rework later. The Google ADK setup determines how all 5 agents communicate.

## Acceptance Criteria

- [ ] Monorepo structure with clear separation: `frontend/`, `agents/`, `shared/`, `data/`
- [ ] React app bootstrapped with TypeScript, Vite, and D3.js dependency
- [ ] Google ADK initialized with agent scaffolding (empty agents that can be invoked)
- [ ] Shared TypeScript types defined for: Portfolio, Holding, ExposureMap, CausalChain, Signal, UserProfile
- [ ] CausalChain JSON schema defined and documented (event → mechanism → sector → asset nodes with edges)
- [ ] Dev server runs with hot reload
- [ ] Basic routing: Portfolio View, Causal Graph View (empty shells)
- [ ] ESLint + Prettier configured
- [ ] Environment variable setup for Gemini API key

## Implementation Details

### Files to Create

```
prism-holdings-intelligence-system/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── routes/
│   │   │   ├── PortfolioView.tsx        # Shell
│   │   │   └── CausalGraphView.tsx      # Shell
│   │   ├── components/                   # Empty, populated by later features
│   │   ├── hooks/                        # Empty
│   │   ├── services/                     # API client stubs
│   │   └── styles/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── agents/
│   ├── orchestrator/
│   │   └── index.ts                     # ADK orchestrator setup
│   ├── exposure-analyzer/
│   │   └── index.ts                     # Agent stub
│   ├── signal-monitor/
│   │   └── index.ts                     # Agent stub
│   ├── causal-propagation/
│   │   └── index.ts                     # Agent stub
│   ├── temporal-reasoner/
│   │   └── index.ts                     # Agent stub
│   └── alert-composer/
│       └── index.ts                     # Agent stub
├── shared/
│   ├── types/
│   │   ├── portfolio.ts                 # Portfolio, Holding, Account types
│   │   ├── exposure.ts                  # ExposureMap, Concentration, Overlap
│   │   ├── causal-chain.ts              # CausalChain, Node, Edge schemas
│   │   ├── signal.ts                    # Signal, SignalClassification
│   │   └── user-profile.ts             # UserProfile, Preferences
│   └── constants/
│       ├── thresholds.ts                # Concentration thresholds, confidence minimums
│       └── temporal.ts                  # TemporalClassification enum
├── data/                                # Populated by Feature 02
├── package.json                         # Workspace root
└── tsconfig.base.json
```

### Key Type Definitions

**CausalChain schema** (the most critical shared type — consumed by agents 03, 05, 07, 08 and rendered by Feature 10):

```typescript
interface CausalChainNode {
  id: string
  type: 'event' | 'mechanism' | 'sector' | 'asset'
  label: string
  description: string
  temporalClassification?: 'transient' | 'structural' | 'ambiguous'
  confidence: number           // 0-1
  dollarImpact?: number        // Only on asset nodes
  percentageImpact?: number    // Only on asset nodes
  metadata: Record<string, unknown>
}

interface CausalChainEdge {
  id: string
  source: string               // Node ID
  target: string               // Node ID
  magnitude: number            // 0-1 (thickness)
  direction: 'positive' | 'negative' | 'ambiguous'
  confidence: number           // 0-1 (opacity)
  mechanism: string            // Human-readable explanation
}

interface CausalChain {
  id: string
  signalId: string
  generatedAt: string          // ISO timestamp
  nodes: ReadonlyArray<CausalChainNode>
  edges: ReadonlyArray<CausalChainEdge>
  summary: string
  disclaimer: string
}
```

### Technical Decisions

- **Monorepo with workspaces** over separate repos — agents and frontend share types without publishing packages
- **Vite over Next.js** — this is a single-page prototype, no SSR needed; Vite is faster for development
- **Readonly arrays in shared types** — enforces immutability at the type level per coding standards
- **Google ADK** — required by PRD; agents are TypeScript functions orchestrated by ADK

## Testing Requirements

- [ ] Unit tests: Shared type validation (zod schemas parse correctly)
- [ ] Integration tests: Dev server starts, routes render shell components
- [ ] Smoke test: Agent stubs can be invoked through orchestrator

## Security Considerations

- [ ] Gemini API key in `.env`, never committed (`.gitignore` includes `.env*`)
- [ ] No hardcoded credentials anywhere

## Implementation Checklist

- [ ] Initialize monorepo with package.json workspaces
- [ ] Bootstrap React app with Vite + TypeScript
- [ ] Install D3.js, React Router, Zod dependencies
- [ ] Set up Google ADK with agent stubs
- [ ] Define all shared types with Zod validation schemas
- [ ] Configure ESLint, Prettier, tsconfig
- [ ] Set up environment variable handling
- [ ] Write tests for type validation
- [ ] Verify dev server runs and routes work
- [ ] Document setup instructions in README

## Notes

- The CausalChain JSON schema is the single most important shared contract. Agents produce it, the frontend consumes it. Getting this right avoids painful rework.
- Google ADK setup should follow their recommended project structure — research latest ADK docs before implementing.
- Keep the frontend shell minimal — just routing and layout. Components come in later features.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
