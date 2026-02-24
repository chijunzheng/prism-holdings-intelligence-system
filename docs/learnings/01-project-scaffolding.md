# Feature 01: Project Scaffolding — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**pnpm monorepo with 5 workspaces:** `frontend`, `shared`, `agents`, `server`, `data`

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| pnpm workspaces | `workspace:*` protocol, fast installs, strict dependency isolation | Requires pnpm (not npm) | **Chosen** — team already has pnpm installed |
| npm workspaces | Zero extra tooling | No `workspace:*` protocol, slower installs, hoisting issues | Rejected |
| Turborepo + pnpm | Build caching, parallel task execution | Overkill for prototype, adds complexity | Rejected — revisit if build times matter |
| Separate repos | Full isolation | Shared types require publishing packages, painful for iteration | Rejected |

### Why This Approach

The prototype's key architectural need is **shared types across frontend and agents**. The CausalChain JSON schema is consumed by 4 agents and rendered by the D3 visualization — it must be a single source of truth. Monorepo with workspace references makes this trivial.

## Key Decisions

### Vite over Next.js
- This is a single-page prototype with no SEO, no SSR, no API routes
- Vite gives faster HMR (~50ms vs ~300ms) and simpler config
- The agents run on a separate Express server, not through framework API routes

### Agent Interface Pattern (TypeScript + ADK JS)
- Domain logic is implemented as **typed async functions**: `(input: T) → Promise<AgentResult<U>>`
- These functions are now wrapped by Google ADK TypeScript runtime components (`LlmAgent`, `FunctionTool`, `InMemoryRunner`)
- This keeps one-language TypeScript development while using an actual ADK framework runtime for orchestration
- **Update:** PRD agent-framework alignment is now restored through ADK JS integration

### Readonly arrays in all shared types
- Enforces immutability at the type level per coding standards
- `ReadonlyArray<CausalChainNode>` prevents accidental mutation of shared data
- Aligns with the immutability rule in `.claude/rules/coding-style.md`

### Zod for runtime validation
- TypeScript types are compile-time only — they don't validate LLM output at runtime
- Zod schemas serve dual purpose: type inference AND runtime validation
- Critical for agents 05, 07, 08 where Gemini output must match expected schema

## What I Learned

1. **pnpm `workspace:*` protocol** doesn't work with npm — we hit this during initial `npm install` and had to switch. The `pnpm-workspace.yaml` file is required alongside `package.json` workspaces.

2. **`as const` assertion on string concatenation** fails in TypeScript 5.7+ — the DISCLAIMER constant needed the `as const` removed because `'string' + 'string' as const` is not a valid const assertion target.

3. **esbuild/protobufjs build approval** — pnpm 10+ requires explicit approval for postinstall scripts. Added `pnpm.onlyBuiltDependencies` to root package.json.

## Files Created

- Root: `package.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `.env.example`, `.gitignore`, `.prettierrc`, `vitest.config.ts`
- Shared types: `shared/src/types/{portfolio,exposure,causal-chain,signal,user-profile,fund}.ts`
- Constants: `shared/src/constants/{temporal,thresholds}.ts`
- Frontend shell: `frontend/src/{App,main}.tsx`, routes, styles
- Agent stubs: 6 agent directories with typed stubs
- Server: Express starter with health endpoint
- Tests: 8 type validation tests
