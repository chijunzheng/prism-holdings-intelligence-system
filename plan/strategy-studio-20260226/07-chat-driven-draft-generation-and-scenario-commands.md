# Feature: Chat-Driven Draft Generation and Scenario Commands

**ID:** 07
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 04, 05, 06

## Description

Enable chat-first strategy workflows where explicit user intent triggers auto-draft creation and command-style scenario edits routed into Strategy Studio.

## Acceptance Criteria

- [x] Explicit intent detection for commands like "build mitigation plan"
- [x] Draft scenario auto-populates only after explicit command (not passive signal load)
- [x] Chat can trigger add/remove/resize candidate operations
- [x] Strategy Studio state updates reflect chat commands immediately
- [x] Command responses include rationale and confidence updates

## Implementation Details

### Files to Create/Modify

- Modify: `agents/src/chat-agent/prompts.ts`
- Modify: `agents/src/chat-agent/index.ts`
- Modify: `server/src/index.ts`
- Modify: `frontend/src/hooks/useChat.ts`
- Modify: `frontend/src/components/chat/ChatPanel.tsx`
- Create: `frontend/src/hooks/useStrategyCommands.ts`

### Command Classes

- `build_draft`
- `add_candidate`
- `remove_candidate`
- `resize_position`
- `evaluate_scenario`

## Testing Requirements

- [ ] Intent detection tests for command vs non-command messages
- [ ] Integration tests for command routing to strategy APIs
- [ ] UI tests verifying chat-command to canvas synchronization

## Notes

- Preserve existing contextual node chat behavior for non-strategy questions.

---

**Created:** 2026-02-26
**Last Updated:** 2026-02-26
