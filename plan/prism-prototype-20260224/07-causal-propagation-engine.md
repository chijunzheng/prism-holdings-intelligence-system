# Feature: Causal Propagation Engine Agent

**ID:** 07
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 03, 05

## Description

Build the Causal Propagation Engine — the agent that takes a classified signal event and the user's ExposureMap, then uses Gemini to generate a multi-hop causal chain as structured JSON. This is the core intelligence: tracing HOW a macro event propagates through economic mechanisms to the user's specific holdings, including competing effects.

## Why This Matters

This agent produces the data structure that powers the entire visual analysis experience. The causal chain JSON is rendered as the D3 graph (Feature 10), analyzed by the Temporal Reasoner (Feature 08), and explored through the Chat Panel (Feature 11). If the chain is poorly structured, inaccurate, or missing competing effects, every downstream feature suffers.

## Acceptance Criteria

- [ ] Generates directed causal chain as structured JSON matching CausalChain schema (FR-3.1)
- [ ] Chain includes event nodes, mechanism nodes, sector nodes, and asset nodes
- [ ] Traces 1st, 2nd, and 3rd order effects; stops when confidence drops below threshold (FR-3.2)
- [ ] Handles COMPETING EFFECTS: positive + negative paths to same holding (FR-3.3)
- [ ] Maps terminal nodes to user's ExposureMap with dollar impact estimates (FR-3.4)
- [ ] Assigns confidence scores to each edge (FR-3.5)
- [ ] Supports what-if propagation: user hypothesizes event, system traces chain (FR-3.6)
- [ ] Chains beyond 3 hops flagged as speculative
- [ ] Mechanism nodes required between event and impact (never correlation-as-causation)
- [ ] Output passes CausalChain Zod schema validation
- [ ] Includes reasoning trace for auditability

## Implementation Details

### Files to Create/Modify

- `agents/causal-propagation/index.ts` — Google ADK agent entry
- `agents/causal-propagation/generate.ts` — Core chain generation via Gemini
- `agents/causal-propagation/prompts.ts` — Prompt templates (critical)
- `agents/causal-propagation/validate.ts` — Zod schema validation + retry logic
- `agents/causal-propagation/what-if.ts` — What-if scenario re-generation
- `agents/causal-propagation/dollar-impact.ts` — Map terminal nodes to ExposureMap dollar values
- `agents/causal-propagation/__tests__/` — Test files

### Prompt Design (The Most Critical Part)

The Gemini prompt must:

1. Provide the signal event with full context and source citations
2. Provide the user's ExposureMap (sectors, top holdings, dollar amounts)
3. Request structured JSON matching the CausalChain schema exactly
4. Explicitly require mechanism nodes (no direct event → holding links)
5. Request competing effects where they exist
6. Request confidence scores per edge with reasoning
7. Cap at 3 hops with speculative flag beyond that
8. Include example output in the prompt for schema adherence

### Validation & Retry Strategy

```
1. Send prompt to Gemini
2. Parse response as JSON
3. Validate against CausalChain Zod schema
4. If validation fails:
   a. Extract specific validation errors
   b. Re-prompt with: "Your output had these schema violations: [errors].
      Please regenerate with corrected structure."
   c. Max 2 retries before returning error
5. If valid: compute dollar impacts from ExposureMap, return chain
```

### Dollar Impact Calculation

Terminal asset nodes from the chain are matched to the ExposureMap:
```
For each asset node in chain:
  Find matching asset in ExposureMap
  dollarImpact = exposureAmount * node.percentageImpact
  Add to node metadata
```

### Technical Decisions

- **Structured output prompting** — provide the exact JSON schema in the prompt with examples
- **Validation-retry loop** — LLM output is non-deterministic; schema validation catches structural errors
- **Dollar impacts computed in code, not by LLM** — LLM provides percentage estimates; code does the math against real portfolio values for accuracy
- **Reasoning traces stored** — each edge includes a `reasoning` field for audit

## Dependencies

### Depends On
- **Feature 03:** ExposureMap for dollar impact mapping
- **Feature 05:** Classified signals as input

### Blocks
- **Feature 08:** Temporal Reasoner analyzes the chain
- **Feature 10:** Causal Graph View renders the chain

## Testing Requirements

- [ ] Unit tests: Prompt construction incorporates signal + ExposureMap correctly
- [ ] Unit tests: Zod validation catches malformed chain JSON
- [ ] Unit tests: Retry logic sends corrective prompt on schema failure
- [ ] Unit tests: Dollar impact calculation maps chain terminals to ExposureMap
- [ ] Unit tests: Competing effects (2 paths to same node) preserved in output
- [ ] Unit tests: 3+ hop chains get speculative flag
- [ ] Integration test: Full signal → Gemini → validated chain → dollar impacts
- [ ] Edge case: Gemini returns chain with no holdings match → graceful handling
- [ ] Edge case: Signal with no clear causal path → low-confidence output

## Implementation Checklist

- [ ] Design prompt template with schema example and constraints
- [ ] Implement Gemini chain generation
- [ ] Implement Zod validation with error extraction
- [ ] Implement retry logic with corrective prompting
- [ ] Implement dollar impact calculation
- [ ] Implement what-if re-generation (modified assumptions)
- [ ] Wire into Google ADK as agent
- [ ] Write unit tests (TDD)
- [ ] Test with live signals from Signal Monitor
- [ ] Iterate on prompt design based on chain quality
- [ ] Document prompt engineering decisions

## Notes

- **This is the hardest agent to get right.** The quality of Gemini's causal reasoning determines the quality of everything the user sees. Plan for extensive prompt iteration.
- Competing effects are the demo's most impressive moment: showing that a rate hike is BOTH positive (bank margins) and negative (loan losses) for the same holdings.
- The what-if capability (FR-3.6) should share the same prompt template with modified event assumptions, not a completely separate code path.
- Keep reasoning traces — they power the Chat Panel's "Why?" interaction pattern.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
