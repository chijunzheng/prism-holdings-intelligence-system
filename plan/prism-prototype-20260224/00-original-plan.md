# Original Plan Source

This feature set was extracted from `/prd.md` — the Prism AI-Native Multi-Horizon Portfolio Intelligence System PRD v1.4 by Jason Chi, February 2026.

The prototype scope is defined in PRD Section 7.3 and targets the Wealthsimple AI Builder application demo.

## Prototype Scope (from PRD)

### Build Real
- Portfolio View with holdings list
- Exposure X-Ray (inline on Portfolio View)
- Concentration detection and warnings
- Signal card rendering on Portfolio View
- Signal card → Causal Graph View navigation
- Interactive causal graph visualization
- One fully worked causal scenario (BoC rate decision)
- Node click → Chat Panel (right-side drawer)
- Chat drilldown with portfolio + user context
- Multi-horizon competing recommendations
- Counterfactual toggle

### Mock/Simulate
- Continuous signal monitoring (simulated event injection)
- Push notification delivery (simulated in-app)
- Full fund composition data pipeline (pre-loaded sample data)
- Multi-user personalization (2-3 user profiles to show contrast)

## Tech Stack
- Frontend: React + D3.js
- LLM: Gemini 3.1 Pro Preview
- Agent Framework: Google ADK
- Data: Pre-loaded sample portfolios (holdings + fund compositions)
- Signal Sources: Gemini with Google Search grounding (live market signals)
- Causal graphs: LLM-generated on-the-fly
