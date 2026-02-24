# Feature: Alert Composer Agent & Personalization Engine

**ID:** 09
**Status:** ✅ Completed
**Priority:** Medium
**Estimated Complexity:** Medium
**Dependencies:** 08

## Description

Build the Alert Composer agent that formats temporal analysis into personalized alerts with appropriate thresholds, and the Personalization Engine shared service that provides user context to multiple agents. The Alert Composer determines WHICH signals are material enough to surface and HOW to present them based on the specific user's profile.

## Why This Matters

Without personalization, a 2% portfolio impact alert goes to everyone equally. With it, the retiree gets a high-urgency alert while the 25-year-old gets a low-priority note. The Personalization Engine is the shared service that makes every agent's output user-specific (FR-5.1 through FR-5.4).

## Acceptance Criteria

- [x] Personalization Engine provides user context to all agents that request it
- [x] Alert materiality thresholds personalized per user profile (FR-5.2)
- [x] Alert language adapts to user's financial literacy level (FR-5.3)
- [x] Same portfolio + different user profiles → different alerts (FR-5.4)
- [x] Recommendations explicitly reference user context in reasoning (FR-5.1)
- [x] Frequency caps enforced: max 2 push notifications per day (FR-7.7)
- [x] Anti-spam: consecutive alerts on same chain suppressed unless magnitude changed
- [x] Alert passes "would a financial advisor call about this?" test
- [x] Formats signal card content: headline, classification badge, materiality indicator

## Implementation Details

### Files to Create/Modify

- `agents/alert-composer/index.ts` — Google ADK agent entry
- `agents/alert-composer/format.ts` — Alert formatting and headline generation
- `agents/alert-composer/thresholds.ts` — Personalized materiality thresholds
- `agents/alert-composer/frequency.ts` — Frequency capping and anti-spam
- `agents/personalization/index.ts` — Shared Personalization Engine service
- `agents/personalization/context.ts` — User context model and queries
- `agents/src/alert-composer/__tests__/alert-composer.test.ts` — Feature 09 test suite
- `agents/alert-composer/__tests__/` — Test files

### Personalization Engine

Not a pipeline agent — a shared data service:

```typescript
interface PersonalizationEngine {
  getUserContext(userId: string): UserProfile
  getMaterialityThreshold(profile: UserProfile): MaterialityThreshold
  getUrgencyMultiplier(profile: UserProfile, classification: TemporalClassification): number
  getToneLevel(profile: UserProfile): 'simple' | 'moderate' | 'advanced'
}
```

### Materiality Thresholds

| User Profile | Min Portfolio Impact | Urgency for Structural |
|-------------|---------------------|----------------------|
| Pre-retiree (58, low risk) | 1% | Critical |
| Balanced (42, moderate risk) | 2% | High |
| Young investor (25, high risk) | 5% | Medium |

### Technical Decisions

- **Personalization Engine is in-memory** for prototype — reads from sample user profile JSON
- **Gemini for headline generation** — natural language formatting personalized to user
- **Frequency tracking in-memory** — simple counter per user per day, resets at midnight

## Dependencies

### Depends On
- **Feature 08:** Temporal analysis as input

### Blocks
- **Feature 12:** Orchestrator needs formatted alerts for demo flow

## Testing Requirements

- [x] Unit tests: Different profiles produce different materiality thresholds
- [x] Unit tests: Frequency cap enforced (3rd alert in day blocked)
- [x] Unit tests: Anti-spam suppresses duplicate chain alerts
- [x] Unit tests: Alert language differs by tone level
- [x] Integration test: Temporal analysis → personalized alert → formatted signal card content

## Implementation Checklist

- [x] Build Personalization Engine shared service
- [x] Implement personalized materiality thresholds
- [x] Implement alert formatting (deterministic tone-adaptive templates for prototype reliability)
- [x] Implement frequency capping
- [x] Implement anti-spam deduplication
- [x] Wire into Google ADK-style agent interface
- [x] Write unit tests (TDD)
- [x] Test with 2-3 demo user profiles to verify contrast

---

**Created:** 2026-02-24
**Last Updated:** 2026-02-24
**Implemented By:** Codex
