# Ask Prism Playbook Copilot Implementation

## Goal
Fix plan-page chat context isolation, add dedicated canvas discussion entry, and enable chat-driven stock recommendation proposals that can update Playbook scenario state after user confirmation.

## Scope
- Ask Prism session scope model (frontend + server)
- Plan canvas CTA and entry context wiring
- New strategy copilot proposal endpoint
- Ask Prism drawer proposal rendering + apply/dismiss actions
- PlanView wiring to apply proposal actions and refresh evaluations
- Validation tests for proposal generation and scope behavior
