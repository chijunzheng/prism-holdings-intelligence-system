import type { StrategyCandidate } from '@prism/shared'

type CandidateForRanking = Omit<StrategyCandidate, 'rankScore'>

function candidateScore(candidate: CandidateForRanking): number {
  return (
    0.45 * candidate.expectedMitigationCad +
    0.2 * candidate.diversificationScore * 100 +
    0.15 * candidate.confidence * 100 -
    0.1 * candidate.estimatedTurnoverCostCad -
    0.1 * candidate.estimatedTaxCostCad
  )
}

export function rankCandidates(
  candidates: ReadonlyArray<CandidateForRanking>,
): ReadonlyArray<StrategyCandidate> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      rankScore: candidateScore(candidate),
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
}
