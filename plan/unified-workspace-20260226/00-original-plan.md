# Original Plan: Unified Prism Workspace

Build a single-page cursor-style workspace for Impact Analysis that unifies holdings analysis, causal graph exploration, Prism chat, and mitigation scenario design. Use an infinite center canvas with expandable graph paths and persist branchable sessions.

## Core decisions
- Single continuous workspace page
- Combined impact + mitigation graph layers on one canvas
- Chat proposes candidates; user drag/drops into canvas
- Server-side persisted sessions with branches/checkpoints
- Side-by-side branch compare mode
- Debounced auto-save + explicit checkpoints
- Default load: current focus signal + portfolio context
- Progressive graph expansion by node click/depth
- Feature-flagged parallel route rollout
- Retention: 50 sessions/user, 200 checkpoints/user with LRU pruning
