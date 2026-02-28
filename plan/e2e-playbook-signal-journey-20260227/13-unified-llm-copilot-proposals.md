# Feature: Unified LLM Copilot Proposals

**ID:** 13
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** None
**Phase:** 4 — Navigating Copilot
**Plan Reference:** A7

## Description

`plan-copilot-service.ts` uses `classifyIntent()` with keyword matching and separate scoring formulas, while the LLM generates explanation text independently. These two systems can disagree — Prism might *say* "I recommend adding ZAG" but the proposal engine suggests a different ticker.

Fix: Use Gemini structured output to generate BOTH the explanation AND the proposal actions in a single call. This ensures Prism's words and actions always agree.

## Acceptance Criteria

- [ ] New `generateUnifiedProposal()` function uses Gemini structured output
- [ ] Single LLM call returns both `explanation` and `actions` (Zod-validated)
- [ ] Actions must only reference candidates from the provided universe
- [ ] Validation-retry loop (max 2 retries) on structured output
- [ ] Falls back to current rule-based approach if all retries fail
- [ ] `plan-copilot-service.ts` kept as fallback (not deleted)
- [ ] Server endpoint updated to try unified approach first

## Implementation Details

### Files to Create

- `agents/src/chat-agent/unified-proposal.ts` — `generateUnifiedProposal()` function

### Files to Modify

- `server/src/index.ts` — Update copilot-proposal endpoint to try unified first
- `server/src/plan-copilot-service.ts` — Keep as fallback, no changes needed

### New Function: `generateUnifiedProposal()`

```typescript
// agents/src/chat-agent/unified-proposal.ts

interface UnifiedProposalInput {
  readonly context: AskPrismContext
  readonly userMessage: string
  readonly history: ReadonlyArray<{ role: string; content: string }>
  readonly candidateUniverse: ReadonlyArray<StrategyCandidate>
}

interface UnifiedProposalOutput {
  readonly explanation: string
  readonly actions: ReadonlyArray<AskPrismPlanAction>
  readonly confidence: number    // 0-1
  readonly followUps: ReadonlyArray<string>
}

export async function generateUnifiedProposal(
  input: UnifiedProposalInput
): Promise<UnifiedProposalOutput>
```

### Gemini Prompt

```
You are Prism, an AI portfolio advisor. Given this portfolio and plan context,
respond to the user's message about their investment plan.

IMPORTANT: Your explanation and actions MUST be consistent. If you suggest
adding a ticker in your explanation, it MUST appear in the actions array.
Actions may ONLY reference candidates from the provided universe.

Available candidates: [list from candidateUniverse]

Return a JSON object with this exact structure:
{
  "explanation": "Your response to the user in 2-3 sentences. Plain English, no jargon.",
  "actions": [
    { "type": "add_candidate", "candidateId": "...", "ticker": "...", "allocationPct": 3 },
    { "type": "remove_candidate", "candidateId": "...", "ticker": "..." },
    { "type": "set_allocation", "candidateId": "...", "ticker": "...", "allocationPct": 5 }
  ],
  "confidence": 0.85,
  "followUps": ["Would you like to see the impact?", "Should I add more protection?"]
}
```

### Structured Output with Gemini

```typescript
const config = {
  responseMimeType: 'application/json',
  responseSchema: unifiedProposalSchema,  // Zod schema converted to JSON Schema
}
```

### Validation-Retry Loop

Same pattern as causal chain generation:
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  const result = await callGemini(prompt, config)
  const parsed = unifiedProposalZodSchema.safeParse(JSON.parse(result))
  if (parsed.success) {
    // Validate actions reference real candidates
    const validActions = parsed.data.actions.every(a =>
      candidateUniverse.some(c => c.id === a.candidateId)
    )
    if (validActions) return parsed.data
  }
  // Retry with error context
}
// Fall back to rule-based approach
return null
```

### Server Endpoint Update

```typescript
app.post('/api/strategy/:userId/copilot-proposal', async (req, res) => {
  // Try unified approach first
  const unified = await generateUnifiedProposal({ context, userMessage, history, candidateUniverse })

  if (unified) {
    return res.json({
      assistantText: unified.explanation,
      proposal: unified.actions.length > 0 ? {
        actions: unified.actions,
        rationale: unified.explanation,
        expectedEffects: [],
        warnings: [],
      } : null,
      followUps: unified.followUps,
    })
  }

  // Fall back to existing split approach
  const proposal = await buildContextualCopilotProposal(...)
  // ... existing code
})
```

## Dependencies

### Blocks
- **Feature 14 (Level 3):** Navigate + Act uses structured output for copilot actions

## Testing Requirements

- [ ] Unit test: `generateUnifiedProposal()` returns valid structured output
- [ ] Unit test: Actions only reference candidates from universe
- [ ] Unit test: Retry loop works on invalid output
- [ ] Unit test: Falls back to null after 3 retries
- [ ] Unit test: Explanation and actions are consistent (if explanation mentions ZAG, actions include ZAG)
- [ ] Integration test: Endpoint tries unified first, falls back correctly

## Implementation Checklist

- [ ] Create `unified-proposal.ts` with Gemini structured output
- [ ] Define Zod schema for UnifiedProposalOutput
- [ ] Implement validation-retry loop
- [ ] Add candidate universe validation
- [ ] Update server endpoint to try unified first
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
