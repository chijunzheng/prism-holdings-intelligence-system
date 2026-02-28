# Implementation Plan: Multi-Agent Portfolio Intelligence System

**Created:** 2026-02-28
**Status:** In Progress
**Total Features:** 22
**Completed:** 6/22

## Progress Summary

| ID | Feature | Status | Dependencies | Tier | Priority |
|----|---------|--------|--------------|------|----------|
| 00 | Project Setup | ✅ Completed | - | 0 | High |
| 01 | Types and Schemas | ✅ Completed | - | 0 | High |
| 02 | Demo Profiles | ✅ Completed | - | 0 | High |
| 03 | Codebase Cleanup | 🔄 In Progress | - | 0 | High |
| 04 | Market Data Service | ✅ Completed | 01 | 1 | High |
| 05 | Risk Profile Inference | ✅ Completed | 01 | 1 | High |
| 06 | Research Brief Template | ⬜ Not Started | 01 | 1 | Medium |
| 07 | Calibration Engine | ✅ Completed | 04 | 2 | High |
| 08 | Analyst Team | ⬜ Not Started | 04 | 2 | High |
| 09 | Researcher Debate | ⬜ Not Started | 08 | 3 | High |
| 10 | Risk Management Team | ⬜ Not Started | 07 | 3 | High |
| 11 | Fund Manager | ⬜ Not Started | 09, 10 | 4 | High |
| 12 | Judge Agent | ⬜ Not Started | 11 | 4 | High |
| 13 | Pipeline Orchestrator | ⬜ Not Started | 12 | 5 | High |
| 14 | Cross-Signal Synthesizer | ⬜ Not Started | 13 | 5 | High |
| 15 | Chat UI Layout | ⬜ Not Started | 03 | 6 | High |
| 16 | Chat Card Components | ⬜ Not Started | 03 | 6 | High |
| 17 | Server API Endpoints | ⬜ Not Started | 13, 15 | 7 | High |
| 18 | Follow-Up Query Routing | ⬜ Not Started | 13, 15 | 7 | Medium |
| 19 | Evaluation Harness | ⬜ Not Started | 13 | 8 | Medium |
| 20 | GCP Deployment | ⬜ Not Started | 17 | 8 | Low |
| 21 | Final Codebase Cleanup | ⬜ Not Started | 00-20 | 9 | Medium |

## Dependency Graph

```
Tier 0 (parallel):  00 ── 01 ── 02 ── 03
                      │    │              │
Tier 1 (parallel):    │    ├── 04 ── 05   │
                      │    │    │    │     │
                      │    │    │    06    │
Tier 2 (parallel):    │    │    ├── 07    │
                      │    │    └── 08    │
Tier 3 (parallel):    │    │         │    │
                      │    │    09 ──┘    │
                      │    │    10 ── 07  │
Tier 4 (seq):         │    │         │    │
                      │    │    11 ──┘    │
                      │    │    12 ── 11  │
Tier 5 (parallel):    │    │         │    │
                      │    │    13 ──┘    │
                      │    │    14 ── 13  │
Tier 6 (parallel):    │    │              │
                      │    │    15 ───────┘
                      │    │    16 ── 03
Tier 7 (parallel):    │    │
                      │    │    17 ── 13+15
                      │    │    18 ── 13+15
Tier 8 (parallel):    │    │
                      │    │    19 ── 13
                      │    │    20 ── 17
```

## Maximum Parallelism Schedule

| Timeslot | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|----------|---------|---------|---------|---------|
| T0 | 00-setup | 01-types | 02-profiles | 03-cleanup |
| T1 | 04-market-data | 05-risk-profile | 06-brief-template | 15-chat-layout |
| T2 | 07-calibration | 08-analysts | 16-chat-cards | - |
| T3 | 09-debate | 10-risk-team | - | - |
| T4 | 11-fund-manager | 12-judge | - | - |
| T5 | 13-orchestrator | 14-cross-signal | 17-server-api | - |
| T6 | 18-follow-up | 19-eval-harness | - | - |
| T7 | 20-gcp-deploy | - | - | - |
| T8 | 21-final-cleanup | - | - | - |

## Architecture Summary

Five-stage multi-agent pipeline with adversarial debate:
1. **Analyst Team** (4 parallel) - Macro, Fundamental, Sentiment, Technical
2. **Researcher Team** (Bull/Bear debate, 2-3 rounds)
3. **Risk Management Team** (3 sequential devil's advocates)
4. **Fund Manager** (synthesis) + **Judge** (quality loop)
5. **Cross-Signal Synthesizer** (portfolio review mode)

Framework: LangGraph (replaces ADK). LLM: Gemini Flash. UI: Single chat interface.

## Notes

- Original plan saved at `plans/multi-agent-pipeline/PLAN.md`
- Feature files in `plans/multi-agent-pipeline/features/`
- All dollar impacts computed from real Yahoo Finance data, not LLM-guessed
- Human-in-the-loop checkpoints at debate resolution and stress test stages
