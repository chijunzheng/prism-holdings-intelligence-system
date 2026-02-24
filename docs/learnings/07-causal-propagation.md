# Feature 07: Causal Propagation Engine — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Gemini structured output with Zod validation-retry loop (max 2 retries)**

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Gemini + Zod validation + retry | Schema enforcement, self-correcting | Up to 3 API calls per chain | **Chosen** |
| Gemini structured output mode | Native JSON schema enforcement | Less flexible, limited schema support | Rejected — Gemini's structured output doesn't support our full schema |
| Pre-seeded graph DB | Instant, deterministic | Not AI-generated, doesn't adapt to new events | Rejected — PRD requires on-the-fly generation |
| Fine-tuned model | Higher quality output | Training data needed, slow iteration | Rejected — prototype scope |

### Why This Approach

LLM output is non-deterministic. The validation-retry loop catches structural errors:
1. Send prompt → get response
2. Validate against CausalChain Zod schema
3. If invalid: extract specific errors, re-prompt with corrections
4. Max 2 retries before returning error

## Key Decisions

### Mechanism nodes required (never correlation-as-causation)
The prompt explicitly states: "NEVER link an event directly to an asset. Every path MUST include at least one mechanism node."
This enforces the PRD constraint: event → mechanism → sector → asset progression.

### Dollar impacts computed in code, not by LLM
LLM provides percentage impact estimates. Code multiplies by actual portfolio values from ExposureMap. This prevents the LLM from hallucinating dollar amounts.

### Max hops computed from actual graph topology
Rather than trusting the LLM's `maxHops` field, we compute it by DFS traversal from event nodes. Chains >3 hops are automatically flagged as speculative.

### Competing effects explicitly requested
The prompt says: "If this event is both positive AND negative for the same sector/asset through different mechanisms, include BOTH paths."
This produces the demo's most impressive visual: green and red edges to the same node.

## What I Learned

1. **Prompt length matters.** The causal chain prompt is ~1500 tokens including the schema example. Including a full JSON example in the prompt dramatically improves schema adherence vs. just describing the schema.

2. **DFS for hop counting** is simple but must handle cycles. In practice, LLM-generated causal chains are DAGs (directed acyclic), but the code should be defensive.

3. **The corrective retry prompt** appends specific Zod errors: "nodes.2.confidence: Expected number, received string." This gives Gemini actionable feedback to fix the exact issue.

## Files Created

- `agents/src/causal-propagation/prompts.ts` — Chain generation + retry prompts
- `agents/src/causal-propagation/validate.ts` — Zod validation + hop computation
- `agents/src/causal-propagation/index.ts` — Agent entry with retry loop
- Tests: 10 tests for prompt construction, validation, hop counting, speculative flagging
