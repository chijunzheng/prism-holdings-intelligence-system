# Feature: Signal Monitor Agent (Live via Gemini Search Grounding)

**ID:** 05
**Status:** ✅ Completed
**Priority:** High
**Estimated Complexity:** High
**Dependencies:** 02, 03

## Description

Build the Signal Monitor agent that uses Gemini with Google Search grounding to pull real, current market events relevant to the user's top exposure concentrations. Instead of simulated/scripted events, the system queries live market data — meaning the demo produces different, relevant results each day based on what's actually happening in markets.

## Why This Matters

This is the critical differentiator in PRD v1.5: the prototype runs on live signals, not canned scenarios. When demoing to Wealthsimple, the system reacts to whatever is actually in the news that day — proving it works, not just that a script was followed. The Signal Monitor takes the user's ExposureMap (from Feature 03) and asks Gemini "what recent events are relevant to this specific exposure profile?"

## Acceptance Criteria

- [ ] Queries Gemini with Google Search grounding, scoped to user's top exposure concentrations (FR-2.1)
- [ ] For each signal, classifies relevance, magnitude, and novelty (FR-2.2)
- [ ] Filters signals below configurable relevance + magnitude threshold (FR-2.3)
- [ ] Deduplicates signals from multiple sources (FR-2.4)
- [ ] All signals include source citations from grounded search results (FR-2.5)
- [ ] Source credibility weighting: official sources > major news > aggregators
- [ ] Distinguishes confirmed events from rumor/speculation
- [ ] Returns structured Signal objects matching shared type schema
- [ ] Works with any user's ExposureMap — not hardcoded to a specific scenario

## Implementation Details

### Files to Create/Modify

- `agents/signal-monitor/index.ts` — Google ADK agent entry point
- `agents/signal-monitor/search-grounding.ts` — Gemini search grounding query construction
- `agents/signal-monitor/classify.ts` — Relevance/magnitude/novelty scoring
- `agents/signal-monitor/filter.ts` — Threshold filtering and deduplication
- `agents/signal-monitor/citations.ts` — Source citation extraction and credibility scoring
- `agents/signal-monitor/prompts.ts` — Prompt templates for Gemini queries
- `agents/signal-monitor/__tests__/` — Test files

### Gemini Search Grounding Flow

```
1. Receive user's ExposureMap (top concentrations: sectors, assets)
2. Construct search-grounding prompt:
   "Search for recent market events, economic data releases, central bank
    communications, earnings reports, or regulatory changes relevant to:
    - Canadian financials sector (43% exposure)
    - US technology sector (22% exposure)
    - Canadian energy sector (11% exposure)
    Return structured results with source citations."
3. Gemini returns grounded results with real URLs and dates
4. Parse into Signal objects, classify each
5. Filter by threshold, deduplicate
6. Return ranked list of classified signals
```

### Prompt Design (Critical)

The prompt must:
- Scope search to the user's SPECIFIC exposures (not generic market news)
- Request structured output matching Signal schema
- Require source URLs and publication dates
- Ask for magnitude assessment relative to historical norms
- Request novelty classification (expected vs. surprising)
- Filter for events from the last 24-72 hours

### Source Credibility Scoring

| Source Type | Credibility Weight |
|-------------|-------------------|
| Central bank official publications | 1.0 |
| Regulatory body announcements | 0.95 |
| Company filings (SEC/SEDAR) | 0.9 |
| Major financial news (Reuters, Bloomberg, FT) | 0.8 |
| National newspapers (Globe & Mail, WSJ) | 0.7 |
| Financial aggregators | 0.5 |
| Social media / forums | 0.2 |

### Technical Decisions

- **Gemini with Google Search grounding** — provides live web search results with citations, no custom news API needed
- **ExposureMap as input** — signals are personalized from the start, not generic-then-filtered
- **Prompt engineering over code logic** — classification quality depends on prompt design; invest heavily here
- **Citation preservation** — every signal carries its source URLs through the entire pipeline to the Chat Panel

## Dependencies

### Depends On
- **Feature 02:** Sample portfolio data (for testing) and user profiles
- **Feature 03:** ExposureMap (the agent needs to know what exposures to search for)

### Blocks
- **Feature 06:** Signal Cards need classified signals to display
- **Feature 07:** Causal Propagation Engine receives classified signals

## Testing Requirements

- [ ] Unit tests: Prompt construction correctly incorporates top exposures from ExposureMap
- [ ] Unit tests: Signal classification parsing handles various Gemini response formats
- [ ] Unit tests: Threshold filtering removes low-relevance signals
- [ ] Unit tests: Deduplication handles overlapping events
- [ ] Unit tests: Citation extraction produces valid source objects
- [ ] Integration test: Full pipeline from ExposureMap → Gemini query → classified signals
- [ ] Edge case: Gemini returns no relevant results → graceful empty state
- [ ] Edge case: Gemini returns malformed response → retry with corrective prompt

## Security Considerations

- [ ] Gemini API key in environment variables, never hardcoded
- [ ] No user PII sent to Gemini — only sector/asset exposure percentages
- [ ] Source URLs validated before presenting to user

## Implementation Checklist

- [ ] Design and test prompt templates for search grounding
- [ ] Implement Gemini search grounding integration
- [ ] Implement response parsing into Signal objects
- [ ] Implement relevance/magnitude/novelty classification
- [ ] Implement source credibility scoring
- [ ] Implement threshold filtering and deduplication
- [ ] Wire into Google ADK as agent
- [ ] Write unit tests (TDD)
- [ ] Test with real Gemini API against demo portfolio exposures
- [ ] Iterate on prompt design based on result quality
- [ ] Document prompt engineering decisions and rationale

## Notes

- **Prompt iteration is the main work here.** The code is straightforward; getting Gemini to return well-structured, relevant, properly-scoped signals requires careful prompt engineering. Plan for multiple iterations.
- The search grounding approach means results vary by day. Tests should validate structure and classification logic, not specific content.
- Consider a caching layer (5-15 min TTL) to avoid hitting Gemini on every page load — signals don't change second-by-second.
- No user PII goes to Gemini — only "43% Canadian financials, 22% US tech" style exposure summaries.

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
