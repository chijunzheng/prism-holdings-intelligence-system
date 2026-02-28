# Feature: Evaluation Harness

**ID:** 19
**Status:** ⬜ Not Started
**Priority:** Medium
**Estimated Complexity:** High
**Dependencies:** 13 (Pipeline Orchestrator)
**Tier:** 8

## Description

Build a benchmarking tool that runs the multi-agent pipeline against 25 real historical events with ground truth outcomes from Yahoo Finance. Measures directional accuracy, confidence range calibration, and evidence grounding. Compares multi-agent vs single-agent vs naive baseline.

## Acceptance Criteria

- [ ] 25 historical events curated with dates, descriptions, and source URLs
- [ ] Ground truth: actual 5-day returns for all 6 ETFs from Yahoo Finance
- [ ] Runs multi-agent pipeline against each event (skipCheckpoints: true)
- [ ] Runs single-agent baseline (existing single Gemini call) against each event
- [ ] Computes directional accuracy per system
- [ ] Computes confidence range coverage per system
- [ ] Computes evidence grounding score (LLM-as-judge)
- [ ] Generates comparison report (markdown + console output)
- [ ] Report shows per-event-type breakdown (rate decisions, oil shocks, etc.)

## Files to Create

- `eval/events/` - 25 JSON event files
- `eval/historical-prices/` - Cached Yahoo Finance price data
- `eval/harness.ts` - Main evaluation runner
- `eval/metrics.ts` - Metric computation functions
- `eval/compare.ts` - Multi-agent vs single-agent comparison
- `eval/report.ts` - Report generator
- `eval/baselines/single-agent.ts` - Single-agent baseline implementation

## Implementation Details

### Event File Format

```json
{
  "id": "fed-rate-hike-2022-06",
  "type": "rate_decision",
  "date": "2022-06-15",
  "description": "FOMC raises rates by 75bps — largest hike since 1994",
  "sourceUrl": "https://federalreserve.gov/...",
  "actualReturns5d": {
    "VFV": -0.058,
    "XIC": -0.042,
    "ZAG": -0.021,
    "ZEB": -0.015,
    "XEG": -0.072,
    "XGD": 0.018
  }
}
```

### Evaluation Loop

```typescript
async function runEvaluation(): Promise<EvalReport> {
  const events = await loadHistoricalEvents()
  const portfolio = await getPortfolioByUserId('sarah-01')

  const results = await Promise.all(events.map(async (event) => {
    const multiAgent = await runMultiAgentAnalysis({
      signal: eventToSignal(event),
      portfolio,
      skipCheckpoints: true,
    })

    const singleAgent = await runSingleAgentBaseline(
      eventToSignal(event), portfolio
    )

    const actual = event.actualReturns5d

    return { event, multiAgent, singleAgent, actual }
  }))

  return computeMetrics(results)
}
```

### Metrics

**1. Directional Accuracy**
```typescript
function directionalAccuracy(predicted: Direction, actual: number): boolean {
  if (predicted === 'positive') return actual > 0
  if (predicted === 'negative') return actual < 0
  return Math.abs(actual) < 0.005  // Neutral if <0.5% move
}
```

**2. Confidence Range Coverage**
```typescript
function rangeCoverage(predicted: DollarRange, actual: number): boolean {
  return actual >= predicted.low && actual <= predicted.high
}
```

**3. Evidence Grounding (LLM-as-judge)**
```typescript
async function evidenceGrounding(verdict: FundManagerVerdict): Promise<number> {
  // For each mechanism claim in the verdict:
  // 1. Retrieve cited source
  // 2. Ask Gemini Pro: GROUNDED / PARTIALLY_GROUNDED / UNGROUNDED
  // 3. Score: grounded% = (GROUNDED + 0.5 × PARTIAL) / total
}
```

### Report Format

```
═══════════════════════════════════════════
PRISM EVALUATION REPORT — 25 Historical Events
═══════════════════════════════════════════

DIRECTIONAL ACCURACY
Single-agent:  54%  ████████████░░░░░░░░
Multi-agent:   72%  ████████████████████

CONFIDENCE RANGE COVERAGE
Single-agent:  35%  ████████░░░░░░░░░░░░
Multi-agent:   65%  ████████████████░░░░

EVIDENCE GROUNDING
Single-agent:  45%  ██████████░░░░░░░░░░
Multi-agent:   82%  ████████████████████

BY EVENT TYPE
Rate decisions:    80% directional accuracy
Banking events:    75%
CPI surprises:     72%
Oil shocks:        68%
Geopolitical:      55%
═══════════════════════════════════════════
```

### 25 Historical Events (curated from public sources)

Categories:
- 8 rate decisions (Fed + BOC, 2022-2025)
- 4 CPI surprises (2022-2023)
- 4 oil/commodity shocks (OPEC decisions)
- 3 banking stress events (SVB, Credit Suisse, 2023)
- 3 geopolitical events (trade policy, sanctions)
- 3 currency/FX events

## Testing Requirements

- [ ] All 25 event files parse correctly
- [ ] Directional accuracy computation is correct
- [ ] Range coverage computation is correct
- [ ] Report generates valid markdown
- [ ] Single event evaluation completes in <30s

## Implementation Checklist

- [ ] Curate 25 events with dates and descriptions
- [ ] Fetch and cache historical prices from Yahoo Finance
- [ ] Compute actual 5-day returns (CAR) for each event
- [ ] Implement evaluation harness
- [ ] Implement single-agent baseline
- [ ] Implement metrics functions
- [ ] Implement comparison logic
- [ ] Implement report generator
- [ ] Run full evaluation and save results
