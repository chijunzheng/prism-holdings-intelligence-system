# Original Plan: Signals + Playbook Gap Fixes

## Goal
Align current `/signals` and `/signals/:signalId/plan` pages with `plan/signals-playbook-redesign-20260227` acceptance criteria.

## Scope
1. Playbook (`/signals/:signalId/plan`)
   - Ensure header always shows concrete signal context (headline + impact) when available.
   - Keep reasoning collapsible by default.
   - Render selected-node path insight inline below graph when expanded.
   - Keep "Add top 3" as a clear bottom CTA in candidates area.
   - Enforce 14px radius/shadow consistency across cards including evaluation sidebar.

2. Signals workspace (`/signals`)
   - Validate 2-column layout + chip strip + combined impact + contribution table + sidebar card.
   - Keep behavior consistent with chip navigation and overflow.

3. Cleanup
   - Remove dead legacy components from old signal list panel architecture.

4. Verification
   - Run frontend build + full tests.
   - Perform an additional focused code review pass on modified files.
