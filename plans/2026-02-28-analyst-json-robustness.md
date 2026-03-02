# Plan: Analyst JSON Robustness

## Goal
Prevent raw "analyst returned invalid JSON" errors from surfacing in the analysis pipeline.

## Scope
1. Enable stricter JSON output mode for analyst model calls.
2. Add retry path when JSON parsing fails (not only schema validation failures).
3. Improve error messaging with parse/validation context.

## Verification
- Frontend + server build should pass for touched packages.
- Diff review for regression risk in analyst pipeline.
