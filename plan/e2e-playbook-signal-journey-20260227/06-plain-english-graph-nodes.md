# Feature: Plain-English Graph Node Descriptions

**ID:** 06
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** None
**Phase:** 2 — AI Narration Layer
**Plan Reference:** A5

## Description

Graph nodes show labels like "Canadian Bond Yield Shift" or "Credit Spread Compression" — jargon that everyday investors don't understand. Each node gets a pre-computed `plainDescription` field: a one-sentence explanation in everyday language with concrete dollar amounts where possible.

**Examples:**
- **Event:** "The Bank of Canada just changed interest rates, which affects borrowing costs across the economy."
- **Mechanism:** "When rates go up, bond prices typically go down because new bonds pay more interest."
- **Asset:** "Your ZAG bond ETF could lose about $120 because it holds many bonds that become less valuable when rates rise."

## Acceptance Criteria

- [ ] `plainDescription` field added to `CausalChainNode` type in shared types
- [ ] Gemini prompt extended to generate `plainDescription` for each node
- [ ] Zod schema updated with optional `plainDescription` (fallback to `description`)
- [ ] `GraphNode` shows `plainDescription` on hover as a tooltip
- [ ] Node detail panel shows `plainDescription` prominently above technical details
- [ ] Descriptions use concrete dollar amounts for asset nodes
- [ ] No finance jargon in plain descriptions

## Implementation Details

### Files to Modify

- `shared/src/types/` — Add `plainDescription` to `CausalChainNode`
- `agents/src/` — Extend Gemini prompt in `runGraphPipeline()` to generate `plainDescription`
- Zod schema file for causal chain validation — Add optional `plainDescription`
- `frontend/src/components/graph/GraphNode.tsx` — Tooltip on hover
- `frontend/src/routes/signals/SignalDetailPane.tsx` — Show in node detail panel

### Backend: Prompt Extension

Add to the causal chain generation prompt:
```
For each node, also generate a "plainDescription" field: a one-sentence explanation
suitable for someone with no finance background. Use concrete dollar amounts where possible.
For event nodes: explain what happened and why it matters.
For mechanism nodes: explain the cause-and-effect in simple terms.
For asset nodes: explain the dollar impact on the user's specific holding.
```

### Type Changes

```typescript
// In CausalChainNode type
interface CausalChainNode {
  // ... existing fields
  plainDescription?: string  // Plain-English description for everyday investors
}
```

### Zod Schema

```typescript
plainDescription: z.string().optional()
```

Fallback: if Gemini doesn't generate it, use `description` as-is.

### Frontend: GraphNode Tooltip

Show `plainDescription` (or fall back to `description`) on hover via the existing tooltip mechanism (`onHover` callback passes content to `GraphTooltip`). The tooltip should prioritize `plainDescription`.

### Frontend: Node Detail Panel

In `SignalDetailPane.tsx`, the selected node detail section should show:
```tsx
{selectedNode.plainDescription && (
  <p className="node-detail__plain-description">
    {selectedNode.plainDescription}
  </p>
)}
```

Place above the technical `description` field.

## Testing Requirements

- [ ] Unit test: Zod schema validates nodes with and without `plainDescription`
- [ ] Unit test: `GraphNode` tooltip shows `plainDescription` when available
- [ ] Unit test: Fallback to `description` when `plainDescription` is missing
- [ ] Integration test: `runGraphPipeline` returns nodes with `plainDescription`

## Implementation Checklist

- [ ] Add `plainDescription` to CausalChainNode type
- [ ] Update Zod schema with optional field
- [ ] Extend Gemini prompt to generate plain descriptions
- [ ] Update GraphNode hover tooltip to use plainDescription
- [ ] Update node detail panel in SignalDetailPane
- [ ] Add CSS for plain description display
- [ ] Write tests
- [ ] Code review

---

**Created:** 2026-02-27
**Last Updated:** 2026-02-27
