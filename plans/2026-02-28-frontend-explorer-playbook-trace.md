# Frontend Redesign: Explorer + Playbook + Full Trace

## Goal
Redesign Prism's chat UI so users can freely explore holdings/signals, understand how signals impact portfolio risk, and receive explicit step-by-step playbooks while preserving full agent-chain transparency.

## Principles
- Wealthsimple-style minimal interface
- Progressive disclosure (summary first, full chain on demand)
- Explicit action guidance (manual execution checklist)
- Traceable reasoning for every recommendation

## Scope
- Dual-pane explorer-driven interaction
- Dynamic progressive cards for impact, action, and reasoning trace
- Right-side Action Center with recommended playbook
- Additive SSE events for richer progressive UI state

## Non-goals
- Brokerage/order automation
- Session model redesign
- Fundamental domain model changes
