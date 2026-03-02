# Original Plan: Prism Frontend Redesign (Explorer + Playbook + Trace)

## Summary
Convert current chat-centric view into a dual-pane exploration UX with a persistent action center. Introduce progressive intelligence layers: signal delta -> portfolio effect -> explicit playbook -> full reasoning trace.

## Core Decisions
- Clear Playbook: one recommended action path + alternatives
- Layered Reveal: concise default with expandable full chain
- Dual-Pane Explorer: left holdings/signals, right story/action
- Checklist + Manual Confirm execution

## Implementation Outline
1. Introduce typed card contracts and deterministic mapping.
2. Add action/trace card components.
3. Extend `ChatArea` SSE handling to ingest additive events.
4. Add Action Center panel in `ChatView` and wire updates from `ChatArea`.
5. Extend backend analyze SSE with additive events (`impact_delta`, `playbook`, `trace_step`).
6. Update styles for minimal layout and progressive reveal.
7. Validate via tests and typecheck.
