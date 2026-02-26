import type {
  Portfolio,
  StrategyConstraints,
  StrategyEvaluation,
  StrategyObjective,
  StrategyScenario,
} from '@prism/shared'

interface SimulationInput {
  readonly objective: StrategyObjective
  readonly scenario: StrategyScenario
  readonly constraints: StrategyConstraints
  readonly baselineOneMonthCad: number
  readonly baselineSixMonthCad: number
  readonly portfolio: Portfolio
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function hasNonRegisteredAccount(portfolio: Portfolio): boolean {
  return portfolio.accounts.some((account) => account.type === 'NON_REGISTERED')
}

function mitigationCad(scenario: StrategyScenario): number {
  return scenario.items.reduce(
    (sum, item) => sum + item.expectedMitigationCad * Math.max(item.allocationPct, 0),
    0,
  )
}

function diversificationGain(scenario: StrategyScenario): number {
  if (scenario.items.length === 0) return 0
  const avgDiversification =
    scenario.items.reduce((sum, item) => sum + item.diversificationScore, 0) /
    scenario.items.length
  const uniqueTypes = new Set(scenario.items.map((item) => item.type)).size
  return clamp(avgDiversification * 1.4 + uniqueTypes * 0.25, 0, 2.5)
}

function turnoverPct(scenario: StrategyScenario): number {
  return scenario.items.reduce((sum, item) => sum + item.allocationPct, 0)
}

function taxPenaltyCad(
  scenario: StrategyScenario,
  portfolio: Portfolio,
): number {
  const multiplier = hasNonRegisteredAccount(portfolio) ? 1 : 0.45
  return scenario.items.reduce(
    (sum, item) => sum + item.estimatedTaxCostCad * item.allocationPct * multiplier,
    0,
  )
}

export function evaluateScenarioModel({
  objective,
  scenario,
  constraints,
  baselineOneMonthCad,
  baselineSixMonthCad,
  portfolio,
}: SimulationInput): StrategyEvaluation {
  const mitigation = mitigationCad(scenario)

  const downsideReductionCad =
    baselineOneMonthCad < 0
      ? Math.min(Math.abs(baselineOneMonthCad), mitigation)
      : 0

  const proposedOneMonthCad =
    baselineOneMonthCad < 0
      ? baselineOneMonthCad + downsideReductionCad
      : baselineOneMonthCad - mitigation * 0.2

  const sixMonthShift = mitigation * 0.45
  const proposedSixMonthCad =
    baselineSixMonthCad < 0
      ? baselineSixMonthCad + sixMonthShift
      : baselineSixMonthCad - sixMonthShift * 0.25

  const guardrailDelta = proposedSixMonthCad - baselineSixMonthCad
  const diversityGain = diversificationGain(scenario)
  const turnover = turnoverPct(scenario)
  const taxPenalty = taxPenaltyCad(scenario, portfolio)

  const warnings: string[] = []
  if (turnover > constraints.turnoverCapPct) {
    warnings.push(
      `Scenario turnover ${turnover.toFixed(1)}% exceeds profile cap ${constraints.turnoverCapPct.toFixed(1)}%.`,
    )
  }
  if (turnover > constraints.hardMaxTurnoverPct) {
    warnings.push(
      `Scenario turnover ${turnover.toFixed(1)}% exceeds hard max ${constraints.hardMaxTurnoverPct.toFixed(1)}%.`,
    )
  }
  if (scenario.items.length === 0) {
    warnings.push('Scenario has no positions. Add candidates before evaluating.')
  }

  const objectiveSatisfied =
    guardrailDelta >= -Math.max(50, Math.abs(baselineSixMonthCad) * 0.05) &&
    turnover <= constraints.hardMaxTurnoverPct

  const score =
    0.45 * downsideReductionCad +
    0.2 * diversityGain * 100 +
    0.15 * Math.max(0, guardrailDelta) -
    0.1 * turnover * 120 -
    0.1 * taxPenalty

  return {
    generatedAt: new Date().toISOString(),
    objective,
    baselineOneMonthCad,
    proposedOneMonthCad,
    baselineSixMonthCad,
    proposedSixMonthCad,
    downsideReductionCad,
    sixMonthGuardrailDeltaCad: guardrailDelta,
    diversificationGain: diversityGain,
    turnoverPct: turnover,
    turnoverCapPct: constraints.turnoverCapPct,
    taxPenaltyCad: taxPenalty,
    score,
    objectiveSatisfied,
    warnings,
    humanDecisionRequired: true,
  }
}
