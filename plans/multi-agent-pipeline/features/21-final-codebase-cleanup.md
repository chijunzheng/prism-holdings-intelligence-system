# Feature: Final Codebase Cleanup

**ID:** 21
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 00-20 (all other features must be complete)
**Tier:** 9

## Description

Comprehensive post-completion codebase sweep to remove all dead code, unused components, orphaned files, stale imports, and unused dependencies that accumulated during the multi-phase build. This is distinct from Feature 03 (Codebase Cleanup) which removes known dead code from the old UI before building new features. This feature catches anything that became dead *during* the new implementation — old pipeline code replaced by multi-agent, old types superseded by new schemas, leftover components not referenced by the new chat UI, etc.

## Acceptance Criteria

- [ ] `knip` or `ts-prune` reports 0 unused exports across all 5 packages
- [ ] `depcheck` reports 0 unused npm dependencies
- [ ] `pnpm build` produces 0 errors and 0 unused import warnings
- [ ] Full test suite passes — no tests reference deleted modules
- [ ] No orphaned frontend components (every `.tsx` imported somewhere)
- [ ] No orphaned CSS files (every `.css` imported somewhere)
- [ ] No dead server endpoints or services
- [ ] No unused shared types or Zod schemas
- [ ] No stale `// TODO: remove`, `// DEPRECATED`, or `// OLD` comments referencing code that should be deleted
- [ ] Final line count audit documented (before/after comparison)

## Files to Modify

This is a cross-cutting cleanup across all packages:
- `frontend/src/` — components, hooks, routes, styles, utils, types
- `shared/src/` — types, index.ts exports
- `agents/src/` — orchestrator, old pipeline code, chat-agent
- `server/src/` — endpoints, services, route modules
- `data/` — unused data files
- Root `package.json` files — unused dependencies

## Implementation Details

### Step 1: Automated Dead Code Detection

Run static analysis tools to identify unused code:

```bash
# Install analysis tools (dev dependencies)
pnpm add -Dw knip depcheck

# Find unused exports, files, and dependencies
npx knip --reporter compact

# Find unused npm dependencies per package
cd frontend && npx depcheck
cd shared && npx depcheck
cd agents && npx depcheck
cd server && npx depcheck
```

### Step 2: Old Pipeline Code Removal

Check if these old pipeline components are still referenced. If not, delete:

| Code | Package | Replaced By |
|------|---------|------------|
| `runCausalPropagation()` | agents/orchestrator | `runMultiAgentAnalysis()` |
| `runPortfolioNetImpactPipeline()` | agents/orchestrator | `runPortfolioReview()` |
| `CausalChain` type | shared/types | `FundManagerVerdict` + chat cards |
| `StrategyCandidate` type | shared/types | `Recommendation` in FundManagerVerdict |
| `TemporalClassification` type | shared/types | Time horizon in Fund Manager |
| Temporal Reasoner agent | agents/temporal-reasoner | Fund Manager per-horizon recommendations |
| Strategy Engine | agents/strategy | Fund Manager recommendation generation |
| Old signal detail page components | frontend/components/signal | Chat card components |
| D3 causal graph visualization | frontend/components/graph | Chat-based ThinkingCards + TransparencyCard |
| `AskPrismDrawer.tsx` | frontend/components/portfolio | Main chat interface IS Ask Prism now |
| Old workspace/plan session code | server/services | Chat session management |

### Step 3: Frontend Cleanup

```bash
# Check for orphaned components (not imported anywhere)
grep -rL "import.*from" frontend/src/components/ --include="*.tsx" | \
  while read f; do
    basename=$(basename "$f" .tsx)
    if ! grep -r "$basename" frontend/src/ --include="*.tsx" --include="*.ts" -l | grep -v "$f" > /dev/null; then
      echo "ORPHANED: $f"
    fi
  done

# Check for orphaned CSS (not imported anywhere)
for css in frontend/src/styles/*.css; do
  basename=$(basename "$css")
  if ! grep -r "$basename" frontend/src/ --include="*.tsx" --include="*.ts" -l > /dev/null; then
    echo "ORPHANED CSS: $css"
  fi
done
```

### Step 4: Shared Types Cleanup

Review `shared/src/index.ts` — every export should be imported by at least one consumer (frontend, agents, or server). Remove exports of deleted types.

### Step 5: Dependency Cleanup

```bash
# Check each package for unused dependencies
for pkg in frontend shared agents server; do
  echo "=== $pkg ==="
  cd "$pkg" && npx depcheck --ignores="vitest,@types/*" && cd ..
done
```

### Step 6: Verification

```bash
# Full build
pnpm build

# Full test suite
pnpm test

# Line count comparison
echo "Before cleanup:" && find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1
# (compare with count taken before cleanup)
```

## Testing Requirements

- [ ] `pnpm build` succeeds across all packages (0 errors)
- [ ] `pnpm test` passes all tests (no broken imports from deleted modules)
- [ ] No TypeScript `unused import` or `declared but never used` warnings
- [ ] Manual spot-check: navigate the chat UI, trigger an analysis, verify no runtime errors from missing modules

## Implementation Checklist

- [ ] Install `knip` and `depcheck` as dev dependencies
- [ ] Run `knip` — review and act on findings
- [ ] Delete orphaned frontend components
- [ ] Delete orphaned CSS files
- [ ] Delete dead agent/orchestrator code (old pipeline)
- [ ] Delete unused shared types
- [ ] Remove dead server endpoints and services
- [ ] Clean up `shared/src/index.ts` exports
- [ ] Remove unused npm dependencies from all packages
- [ ] Remove stale TODO/DEPRECATED comments
- [ ] Run `pnpm build` — 0 errors
- [ ] Run `pnpm test` — all pass
- [ ] Document line count before/after in DECISIONS.md

## Notes

- This is intentionally the LAST feature — it can only be done after all other features are complete, since earlier features may reference code that later features replace.
- Feature 03 (Codebase Cleanup) handles the *known* dead code from the old multi-page UI. This feature handles *discovered* dead code from the implementation process.
- Be cautious with `_testing` exports (e.g., `market-data.ts._testing`) — these are used by test files and should not be flagged as unused.

---

**Created:** 2026-02-28
**Last Updated:** 2026-02-28
**Implemented By:** —
