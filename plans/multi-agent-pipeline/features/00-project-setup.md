# Feature: Project Setup

**ID:** 00
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** Low
**Dependencies:** None
**Tier:** 0

## Description

Set up the plan directory structure, tracking files, and install LangGraph dependencies. Remove ADK dependency.

## Acceptance Criteria

- [x] Plan saved to `plans/multi-agent-pipeline/PLAN.md`
- [x] Progress tracker at `plans/multi-agent-pipeline/PROGRESS.md`
- [x] Decision log at `plans/multi-agent-pipeline/DECISIONS.md`
- [x] `@langchain/langgraph`, `@langchain/google-genai`, `@langchain/core` installed in agents package
- [x] `@google/adk` removed from agents package
- [x] `agents/src/multi-agent/` directory created with `index.ts`
- [x] `pnpm build` succeeds

## Files to Create/Modify

- `plans/multi-agent-pipeline/PLAN.md` - Full plan document
- `plans/multi-agent-pipeline/PROGRESS.md` - Phase checkpoint tracker
- `plans/multi-agent-pipeline/DECISIONS.md` - Design decision log
- `agents/package.json` - Swap ADK for LangGraph deps
- `agents/src/multi-agent/index.ts` - Public API stub

## Implementation Details

1. Save the full plan as PLAN.md
2. Create PROGRESS.md with todo lists per phase
3. Create DECISIONS.md with initial rationale
4. Run `pnpm remove @google/adk` in agents/
5. Run `pnpm add @langchain/langgraph @langchain/google-genai @langchain/core` in agents/
6. Create `agents/src/multi-agent/index.ts` with exported stubs for `runMultiAgentAnalysis()` and `runPortfolioReview()`

## Implementation Checklist

- [x] Create plan directory and files
- [x] Swap dependencies
- [x] Create multi-agent directory stub
- [x] Verify build succeeds
