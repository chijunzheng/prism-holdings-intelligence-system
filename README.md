# Prism

**AI-native portfolio intelligence for retail investors.**

### [Try the Live Demo](https://prism-671115882624.us-central1.run.app/)

---

## What is Prism?

When a macro event hits — tariffs, rate changes, geopolitical shocks — retail investors have two options: panic-sell or ignore it. Both cost money. Prism gives them a third option: understand exactly how it affects their portfolio in dollars, see the analysis behind it, and decide what to do with clear options and tradeoffs.

Prism is a single conversational interface that runs a 10+ agent adversarial analysis pipeline, produces calibrated dollar-impact estimates grounded in real market data, and delivers actionable recommendations — all while keeping the human in the loop at every critical stage.

## How It Works

```
User asks a question
        |
  Signal Detection (Gemini + Google Search grounding)
        |
  Risk Profile Inference (from actual holdings)
        |
  Market Data (Yahoo Finance — volatility, correlations, prices)
        |
  4 Analyst Agents (macro, fundamental, sentiment, technical)
        |                          <- Human checkpoint: review analyst perspectives
  Bull vs Bear Debate (adversarial, multi-round)
        |                          <- Human checkpoint: review debate outcome
  Risk Management Team
    - Assumptions Challenger (scores confidence on every key claim)
    - Magnitude Validator (checks against historical volatility)
    - Portfolio Stress Tester (10,000 Monte Carlo simulations)
        |                          <- Human checkpoint: review risk challenges
  Fund Manager Synthesis + Judge
        |                          <- Human checkpoint: review verdict
  Recommendations (2-3 options + "do nothing" baseline)
        |
  Save Plan -> Holdings | Download Research Brief as PDF
```

### Key Design Decisions

- **No dollar amount comes from an LLM.** All figures are formula-derived: `holdingValue x magnitude x direction x timeMultiplier`, bounded by computed historical volatility from Yahoo Finance.
- **Human-in-the-loop is non-optional.** The pipeline pauses at four checkpoints. Users can review, challenge, and correct assumptions. Every verdict carries `humanDecisionRequired: true` as a literal type constraint.
- **Options, not answers.** Prism always presents multiple plans with tradeoffs and a "do nothing" baseline. It never auto-executes trades.
- **Full transparency.** Every agent's reasoning, every debate round, every assumption challenge, and every number's derivation is visible and auditable.

## Evaluation

Benchmarked against 25 real historical macro events with ground-truth 5-day returns from Yahoo Finance:

| System | Overall Quality (0-5) |
|---|---|
| Single-Agent Gemini 2.5 Flash | 1.5 |
| Single-Agent Gemini 2.5 Pro | 1.5 |
| **Prism Multi-Agent Pipeline (Flash)** | **4.2** |

The multi-agent pipeline scores +2.7 over the best single-agent baseline — running on the cheaper model. Largest gains in risk identification (0 -> 5.0) and recommendation quality (0 -> 4.6), capabilities structurally absent from single-agent systems.

Full evaluation report: [`eval/REPORT.md`](eval/REPORT.md)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 6 |
| LLM | Gemini Flash (all agents) with Google Search grounding |
| Agent Framework | LangGraph (`@langchain/langgraph`) |
| Market Data | Yahoo Finance API (cached 24h TTL) |
| Server | Express.js |
| Monorepo | pnpm workspaces (frontend, shared, agents, server, data, eval) |
| Deployment | Google Cloud Run |
| Observability | LangSmith |

## Project Structure

```
agents/          Multi-agent pipeline (analysts, debate, risk team, synthesis)
server/          Express API server
frontend/        React chat interface
shared/          Shared types and utilities
data/            Sample portfolios and fund data
eval/            Evaluation harness and benchmark results
```

## Local Development

```bash
pnpm install
pnpm -w dev        # starts frontend + server concurrently
```

Requires environment variables for Gemini API key and Yahoo Finance access. See `.env.example`.

---

*Prism provides analysis, not financial advice. Always verify before acting.*
