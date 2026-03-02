# Plan: Multi-Agent JSON Hardening (Debate + Risk)

## Goal
Eliminate raw JSON parse failures from LLM outputs in portfolio review pipeline.

## Scope
1. Harden Bull researcher JSON parsing.
2. Harden Bear researcher JSON parsing.
3. Harden Assumptions Challenger JSON parsing.
4. Add safe fallback outputs so one malformed model response does not kill the whole run.

## Verification
- `@prism/agents` typecheck.
- Targeted tests for debate/risk modules.
- Frontend build sanity.
