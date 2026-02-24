import type { CausalChain, UserProfile } from '@prism/shared'

export function buildTemporalReasoningPrompt(
  chain: CausalChain,
  profile: UserProfile,
): string {
  return `You are a portfolio temporal reasoning analyst.

User profile:
- Name: ${profile.name}
- Age: ${profile.age}
- Risk tolerance: ${profile.riskTolerance}
- Goals: ${profile.goals.join(', ')}
- Horizon (years): ${profile.investmentHorizonYears}

Causal chain summary:
${chain.summary}

Classify each impact as transient, structural, or ambiguous.
Then provide:
1) one-week, one-month, and six-month impact estimates with confidence intervals
2) short-vs-long horizon tensions when recommendations conflict
3) concrete rebalancing options with dollar amounts and tradeoffs
4) counterfactual analysis ("If rebalanced 3 months ago...")

Return strictly valid JSON.`
}
