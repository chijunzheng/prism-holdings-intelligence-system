# Original Plan: Ask Prism Reliability + Grounded Context

## Goal
Fix broken "Discuss with Prism" / "Ask Prism" interactions and upgrade backend Ask Prism context so responses are grounded in full holdings + live internet signals with clear session scope management.

## Decisions
1. Session model: Hybrid threads (global + scoped signal/node threads).
2. Grounding model: Snapshot per turn (cached+fresh pipeline context with provenance metadata).
3. Discuss behavior: Auto-send scoped prompt when opened from contextual UI actions.

## Steps
1. Fix Ask Prism rendering/wiring for Signals routes.
2. Add entry context + session scope plumbing from frontend actions into Ask Prism payload.
3. Add `signals_overview` page context and include net-impact grounding context.
4. Add scoped session IDs in chat agent for global/signal/node continuity.
5. Extend Ask Prism prompt/context model to include focused node, net-impact, and snapshot metadata.
6. Verify via typecheck/tests and perform focused code review pass.
