# Feature 05: Signal Monitor Agent — Learnings

**Implemented:** 2026-02-24
**Status:** Complete

## Approach Chosen

**Gemini with Google Search grounding, structured output parsing, 15-min cache**

### Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Gemini + Search grounding | Live signals, source citations, no news API | Varies by day, non-deterministic | **Chosen** — PRD requirement |
| Pre-scripted signals | Predictable demo | Defeats the "live signals" value prop | Rejected |
| News API (NewsAPI, Alpha Vantage) | Structured data | No AI classification, requires paid API, no search grounding | Rejected |
| Gemini without grounding | Cheaper | No source citations, may hallucinate events | Rejected |

### Why This Approach

The PRD's key differentiator is live signals: "Demo produces different results each day based on actual market events." Gemini with Google Search grounding provides web-sourced, cited results without a separate news API.

> Note: runtime model is now `gemini-3.0-pro-preview` because `gemini-2.0-flash` is no longer available to new users.

## Key Decisions

### Prompt scoped to user's exposures, not generic news
The prompt includes: "The investor has concentrated exposures in Canadian Financials (17.1%), US Technology (12%)..."
This ensures signals are **personalized from the start** — not "here's all market news" then filtered.

### 15-minute cache TTL
Market signals don't change second-by-second. Caching prevents:
- Excessive Gemini API calls during demo (page refreshes)
- Rate limiting issues
- Inconsistent results during a single demo session

### Deduplication by headline similarity
Headlines are normalized (lowercase, alphanumeric only, first 20 chars) and compared. Two articles about "BoC Rate Decision" from different sources are merged, keeping the higher-relevance version.

### No user PII sent to Gemini
Only sector names and percentage numbers are sent. No names, account numbers, or dollar amounts.

## What I Learned

1. **Gemini may wrap JSON in markdown fences.** The parser needs to handle `\`\`\`json\n[...]\n\`\`\`` as well as raw JSON arrays.

2. **Dedup key length matters.** Initial 30-char key was too long — "bocratedecisionfebruary2026" (27 chars) and "bocratedecisionfebruary2026upd" (30 chars) didn't match. Shortened to 20 chars to catch more duplicates.

3. **Relevance score clamping** is necessary — Gemini sometimes returns scores >1.0. `Math.min(1, Math.max(0, score))` ensures valid range.

## Files Created

- `agents/src/signal-monitor/prompts.ts` — Search grounding prompt construction
- `agents/src/signal-monitor/parse.ts` — Response parsing + deduplication
- `agents/src/signal-monitor/index.ts` — Agent entry with cache
- Tests: 8 tests for prompt, parsing, dedup
