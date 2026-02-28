import type {
  AskPrismCopilotProposalResponse,
  AskPrismEntryContext,
  AskPrismPlanAction,
  AskPrismPlanProposal,
  AskPrismSessionScope,
  PlanSelection,
  StrategyCandidate,
} from '@prism/shared'

interface CopilotHistoryMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface PlanCopilotRequest {
  readonly signalId?: string
  readonly sessionScope?: AskPrismSessionScope
  readonly entryContext?: AskPrismEntryContext
  readonly message: string
  readonly currentSelections: ReadonlyArray<PlanSelection>
  readonly candidateUniverse: ReadonlyArray<StrategyCandidate>
  readonly history: ReadonlyArray<CopilotHistoryMessage>
}

interface BuildPlanCopilotResponseOptions {
  readonly message: string
  readonly assistantText?: string
  readonly currentSelections: ReadonlyArray<PlanSelection>
  readonly candidateUniverse: ReadonlyArray<StrategyCandidate>
  readonly signalHeadline?: string
  readonly signalOneMonthImpactCad?: number
  readonly topExposureLabel?: string
  readonly warningCount?: number
}

type ParseResult =
  | { readonly ok: true; readonly data: PlanCopilotRequest }
  | { readonly ok: false; readonly error: string }

interface CopilotIntent {
  readonly wantsAlternative: boolean
  readonly wantsAdd: boolean
  readonly wantsRemove: boolean
  readonly wantsAllocationChange: boolean
  readonly wantsDiversification: boolean
  readonly wantsRiskReduction: boolean
}

interface SelectionCandidatePair {
  readonly selection: PlanSelection
  readonly candidate?: StrategyCandidate
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hasAny(text: string, keywords: ReadonlyArray<string>): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function formatCad(value: number): string {
  const rounded = Math.round(value)
  return `$${rounded.toLocaleString('en-CA')}`
}

function dedupeStrings(values: ReadonlyArray<string>, limit = 4): ReadonlyArray<string> {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const next = value.trim()
    if (!next) continue
    const key = next.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(next)
    if (out.length >= limit) break
  }
  return out
}

function parseEntryType(value: unknown): AskPrismEntryContext['entryType'] | null {
  const raw = asString(value)
  if (
    raw === 'fab' ||
    raw === 'signal_card' ||
    raw === 'signals_canvas' ||
    raw === 'graph_node' ||
    raw === 'sidebar_cta'
  ) {
    return raw
  }
  return null
}

function sanitizeHistory(
  value: unknown,
): ReadonlyArray<CopilotHistoryMessage> {
  if (!Array.isArray(value)) return []
  return value
    .map((item): CopilotHistoryMessage | null => {
      if (!isRecord(item)) return null
      const role = asString(item.role)
      const content = asString(item.content)?.trim()
      if (!content || (role !== 'user' && role !== 'assistant')) return null
      return { role, content }
    })
    .filter((item): item is CopilotHistoryMessage => item !== null)
}

function sanitizeSelections(value: unknown): ReadonlyArray<PlanSelection> {
  if (!Array.isArray(value)) return []

  const selections: PlanSelection[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!isRecord(item)) continue
    const candidateId = asString(item.candidateId)?.trim()
    const ticker = asString(item.ticker)?.trim().toUpperCase()
    const name = asString(item.name)?.trim()
    const allocationPct = asNumber(item.allocationPct)
    if (!candidateId || !ticker || !name || allocationPct === null) continue
    if (seen.has(candidateId)) continue
    seen.add(candidateId)
    selections.push({
      candidateId,
      ticker,
      name,
      allocationPct: clamp(allocationPct, 0.1, 10),
    })
  }
  return selections
}

function sanitizeCandidateUniverse(value: unknown): ReadonlyArray<StrategyCandidate> {
  if (!Array.isArray(value)) return []

  const candidates: StrategyCandidate[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (!isRecord(item)) continue
    const id = asString(item.id)?.trim()
    const ticker = asString(item.ticker)?.trim().toUpperCase()
    const name = asString(item.name)?.trim()
    if (!id || !ticker || !name || seen.has(id)) continue

    const typeRaw = asString(item.type)
    const type = typeRaw === 'stock' || typeRaw === 'cash' || typeRaw === 'etf' ? typeRaw : 'etf'

    const liquidityRaw = asString(item.liquidityTier)
    const liquidityTier =
      liquidityRaw === 'low' || liquidityRaw === 'medium' || liquidityRaw === 'high'
        ? liquidityRaw
        : 'medium'

    const parsed: StrategyCandidate = {
      id,
      ticker,
      name,
      type,
      rationale: asString(item.rationale) ?? '',
      confidence: clamp(asNumber(item.confidence) ?? 0.5, 0, 1),
      expectedMitigationCad: asNumber(item.expectedMitigationCad) ?? 0,
      proposedShiftPct: clamp(asNumber(item.proposedShiftPct) ?? 1, 0.1, 10),
      diversificationScore: clamp(asNumber(item.diversificationScore) ?? 0.5, 0, 1),
      estimatedTurnoverCostCad: Math.max(asNumber(item.estimatedTurnoverCostCad) ?? 0, 0),
      estimatedTaxCostCad: Math.max(asNumber(item.estimatedTaxCostCad) ?? 0, 0),
      isLargeCapProxy: asBoolean(item.isLargeCapProxy) ?? false,
      liquidityTier,
      rankScore: asNumber(item.rankScore) ?? 0,
    }

    seen.add(id)
    candidates.push(parsed)
  }
  return candidates
}

function parseAllocationFromMessage(message: string): number | null {
  const match = message.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  return clamp(value, 0.5, 10)
}

function normalizeTickerMentions(
  message: string,
  candidates: ReadonlyArray<StrategyCandidate>,
  selections: ReadonlyArray<PlanSelection>,
): ReadonlySet<string> {
  const text = message.toLowerCase()
  const tickers = new Set<string>()
  for (const candidate of candidates) {
    if (text.includes(candidate.ticker.toLowerCase())) {
      tickers.add(candidate.ticker)
    }
  }
  for (const selection of selections) {
    if (text.includes(selection.ticker.toLowerCase())) {
      tickers.add(selection.ticker)
    }
  }
  return tickers
}

function classifyIntent(message: string): CopilotIntent {
  const text = message.toLowerCase()

  return {
    wantsAlternative: hasAny(text, [
      'better option',
      'better alternatives',
      'alternative',
      'replace',
      'swap',
      'instead',
      'different stock',
      'different stocks',
    ]),
    wantsAdd: hasAny(text, ['add', 'include', 'recommend', 'suggest', 'buy', 'new position']),
    wantsRemove: hasAny(text, ['remove', 'drop', 'delete', 'exclude', 'take out', 'exit']),
    wantsAllocationChange: hasAny(text, [
      'allocation',
      'allocate',
      'size',
      'sizing',
      'increase',
      'decrease',
      'raise',
      'lower',
      'trim',
      'set to',
    ]) || /(\d+(?:\.\d+)?)\s*%/.test(text),
    wantsDiversification: hasAny(text, [
      'divers',
      'concentration',
      'overlap',
      'overweight',
      'single sector',
      'sector risk',
      'exposure',
      'spread',
    ]),
    wantsRiskReduction: hasAny(text, [
      'risk',
      'downside',
      'mitigat',
      'hedge',
      'defensive',
      'protect',
      'drawdown',
      'volatility',
      'concern',
    ]),
  }
}

function scoreCandidateForRisk(candidate: StrategyCandidate): number {
  return (
    candidate.expectedMitigationCad * 0.55 +
    candidate.diversificationScore * 70 +
    candidate.confidence * 45 +
    candidate.rankScore * 0.2 -
    candidate.estimatedTurnoverCostCad * 0.1 -
    candidate.estimatedTaxCostCad * 0.12
  )
}

function scoreCandidateForDiversification(candidate: StrategyCandidate): number {
  const typeBonus = candidate.type === 'cash' ? 8 : candidate.type === 'etf' ? 4 : 0
  return (
    candidate.diversificationScore * 110 +
    candidate.confidence * 40 +
    candidate.expectedMitigationCad * 0.25 +
    typeBonus -
    candidate.estimatedTurnoverCostCad * 0.05 -
    candidate.estimatedTaxCostCad * 0.06
  )
}

function scoreCandidateForReplacement(candidate: StrategyCandidate): number {
  return (
    candidate.rankScore * 0.4 +
    candidate.expectedMitigationCad * 0.4 +
    candidate.diversificationScore * 65 +
    candidate.confidence * 30 -
    candidate.estimatedTurnoverCostCad * 0.08 -
    candidate.estimatedTaxCostCad * 0.1
  )
}

function sortByScoreDescending(
  candidates: ReadonlyArray<StrategyCandidate>,
  scorer: (candidate: StrategyCandidate) => number,
): ReadonlyArray<StrategyCandidate> {
  return [...candidates].sort((a, b) => scorer(b) - scorer(a))
}

function buildSelectionCandidatePairs(
  selections: ReadonlyArray<PlanSelection>,
  candidateById: ReadonlyMap<string, StrategyCandidate>,
): ReadonlyArray<SelectionCandidatePair> {
  return selections.map((selection) => ({
    selection,
    candidate: candidateById.get(selection.candidateId),
  }))
}

function weakestSelectedPair(
  pairs: ReadonlyArray<SelectionCandidatePair>,
): SelectionCandidatePair | null {
  if (pairs.length === 0) return null

  let weakest = pairs[0]
  let weakestScore = weakest.candidate ? scoreCandidateForReplacement(weakest.candidate) : -Infinity
  for (let index = 1; index < pairs.length; index += 1) {
    const pair = pairs[index]
    const score = pair.candidate ? scoreCandidateForReplacement(pair.candidate) : -Infinity
    if (score < weakestScore) {
      weakest = pair
      weakestScore = score
    }
  }
  return weakest
}

function findSelectedByTicker(
  pairs: ReadonlyArray<SelectionCandidatePair>,
  tickers: ReadonlySet<string>,
): SelectionCandidatePair | null {
  for (const pair of pairs) {
    if (tickers.has(pair.selection.ticker)) {
      return pair
    }
  }
  return null
}

function findUnselectedByTicker(
  candidates: ReadonlyArray<StrategyCandidate>,
  tickers: ReadonlySet<string>,
): StrategyCandidate | null {
  for (const candidate of candidates) {
    if (tickers.has(candidate.ticker)) return candidate
  }
  return null
}

function hasActionForCandidate(
  actions: ReadonlyArray<AskPrismPlanAction>,
  candidateId: string,
  type?: AskPrismPlanAction['type'],
): boolean {
  return actions.some((action) =>
    action.candidateId === candidateId && (type ? action.type === type : true),
  )
}

function buildProposal(
  message: string,
  currentSelections: ReadonlyArray<PlanSelection>,
  candidateUniverse: ReadonlyArray<StrategyCandidate>,
): AskPrismPlanProposal | null {
  if (candidateUniverse.length === 0) return null

  const intent = classifyIntent(message)
  const requestedAllocation = parseAllocationFromMessage(message)
  const mentionedTickers = normalizeTickerMentions(message, candidateUniverse, currentSelections)
  const selectedIdSet = new Set(currentSelections.map((selection) => selection.candidateId))
  const candidateById = new Map(candidateUniverse.map((candidate) => [candidate.id, candidate]))
  const selectedPairs = buildSelectionCandidatePairs(currentSelections, candidateById)
  const unselected = candidateUniverse.filter((candidate) => !selectedIdSet.has(candidate.id))

  const actions: AskPrismPlanAction[] = []

  if (intent.wantsAlternative && unselected.length > 0) {
    const removeTarget = findSelectedByTicker(selectedPairs, mentionedTickers) ?? weakestSelectedPair(selectedPairs)
    const replacement =
      (findUnselectedByTicker(unselected, mentionedTickers) ??
      sortByScoreDescending(
        unselected,
        intent.wantsDiversification ? scoreCandidateForDiversification : scoreCandidateForReplacement,
      )[0]) ?? null

    if (removeTarget && !hasActionForCandidate(actions, removeTarget.selection.candidateId, 'remove_candidate')) {
      actions.push({
        type: 'remove_candidate',
        candidateId: removeTarget.selection.candidateId,
        ticker: removeTarget.selection.ticker,
      })
    }

    if (replacement && !hasActionForCandidate(actions, replacement.id, 'add_candidate')) {
      const allocationPct = clamp(
        requestedAllocation ?? removeTarget?.selection.allocationPct ?? replacement.proposedShiftPct,
        0.5,
        10,
      )
      actions.push({
        type: 'add_candidate',
        candidateId: replacement.id,
        ticker: replacement.ticker,
        allocationPct,
      })
    }
  } else {
    if (intent.wantsRemove) {
      const target = findSelectedByTicker(selectedPairs, mentionedTickers) ?? weakestSelectedPair(selectedPairs)
      if (target && !hasActionForCandidate(actions, target.selection.candidateId, 'remove_candidate')) {
        actions.push({
          type: 'remove_candidate',
          candidateId: target.selection.candidateId,
          ticker: target.selection.ticker,
        })
      }
    }

    const shouldAdd =
      intent.wantsAdd ||
      intent.wantsDiversification ||
      intent.wantsRiskReduction ||
      (currentSelections.length === 0 && !intent.wantsRemove && !intent.wantsAllocationChange)

    if (shouldAdd && unselected.length > 0) {
      const ranked = sortByScoreDescending(
        unselected,
        intent.wantsDiversification ? scoreCandidateForDiversification : scoreCandidateForRisk,
      )
      const targetCandidate = findUnselectedByTicker(ranked, mentionedTickers) ?? ranked[0]
      if (targetCandidate && !hasActionForCandidate(actions, targetCandidate.id, 'add_candidate')) {
        actions.push({
          type: 'add_candidate',
          candidateId: targetCandidate.id,
          ticker: targetCandidate.ticker,
          allocationPct: clamp(requestedAllocation ?? targetCandidate.proposedShiftPct, 0.5, 10),
        })
      }
    }
  }

  if (intent.wantsAllocationChange && selectedPairs.length > 0) {
    const target =
      findSelectedByTicker(selectedPairs, mentionedTickers) ??
      (actions.find((action) => action.type === 'add_candidate')
        ? null
        : selectedPairs[0])
    if (target && requestedAllocation !== null) {
      if (!hasActionForCandidate(actions, target.selection.candidateId, 'set_allocation')) {
        actions.push({
          type: 'set_allocation',
          candidateId: target.selection.candidateId,
          ticker: target.selection.ticker,
          allocationPct: requestedAllocation,
        })
      }
    }
  }

  if (actions.length === 0) return null

  const projectedAllocationById = new Map(
    currentSelections.map((selection) => [selection.candidateId, selection.allocationPct]),
  )
  for (const action of actions) {
    if (action.type === 'remove_candidate') {
      projectedAllocationById.delete(action.candidateId)
    } else {
      projectedAllocationById.set(action.candidateId, action.allocationPct)
    }
  }
  const projectedTotalAllocation = [...projectedAllocationById.values()].reduce((sum, value) => sum + value, 0)

  const expectedEffects: string[] = []
  const warnings: string[] = []

  for (const action of actions) {
    const candidate = candidateById.get(action.candidateId)
    if (action.type === 'add_candidate') {
      if (candidate) {
        const base = Math.max(candidate.proposedShiftPct, 0.5)
        const scaledMitigation = candidate.expectedMitigationCad * (action.allocationPct / base)
        expectedEffects.push(
          `${candidate.ticker} at ${action.allocationPct.toFixed(1)}% targets roughly ${formatCad(scaledMitigation)} of one-month downside offset.`,
        )
        if (candidate.liquidityTier === 'low') {
          warnings.push(`${candidate.ticker} is lower-liquidity; size additions carefully.`)
        }
        if (candidate.estimatedTaxCostCad > 80) {
          warnings.push(`${candidate.ticker} carries elevated estimated tax drag.`)
        }
      } else {
        expectedEffects.push(`Adds ${action.ticker} at ${action.allocationPct.toFixed(1)}% to broaden mitigation coverage.`)
      }
    } else if (action.type === 'remove_candidate') {
      expectedEffects.push(`Removes ${action.ticker}, trimming overlap but reducing current hedge coverage.`)
    } else {
      expectedEffects.push(`Resizes ${action.ticker} to ${action.allocationPct.toFixed(1)}% to rebalance risk reduction vs. turnover.`)
    }
  }

  if (projectedTotalAllocation > 10) {
    warnings.push(`Projected mitigation sleeve is ${projectedTotalAllocation.toFixed(1)}%, which may exceed practical turnover limits.`)
  } else if (projectedTotalAllocation > 6) {
    warnings.push(`Projected mitigation sleeve is ${projectedTotalAllocation.toFixed(1)}%; review turnover and tax impact before execution.`)
  }

  const rationaleParts: string[] = []
  if (intent.wantsDiversification) {
    rationaleParts.push('This tilts toward higher diversification candidates to reduce concentration risk.')
  }
  if (intent.wantsRiskReduction) {
    rationaleParts.push('The sizing favors candidates with stronger estimated downside mitigation.')
  }
  if (intent.wantsAlternative) {
    rationaleParts.push('It swaps weaker current coverage for a stronger-ranked alternative from your candidate universe.')
  }
  if (rationaleParts.length === 0) {
    rationaleParts.push('This update is constrained to your current candidate universe and active Playbook selections.')
  }

  return {
    actions,
    rationale: rationaleParts.join(' '),
    expectedEffects: dedupeStrings(expectedEffects, 4),
    warnings: dedupeStrings(warnings, 3),
  }
}

function buildFallbackAssistantText(options: BuildPlanCopilotResponseOptions): string {
  const {
    message,
    currentSelections,
    signalHeadline,
    signalOneMonthImpactCad,
    topExposureLabel,
    warningCount,
  } = options

  const lines: string[] = []
  lines.push(`I reviewed your Playbook request: "${message.trim()}".`)

  if (signalHeadline) {
    lines.push(`This plan is anchored to **${signalHeadline}**.`)
  }
  if (typeof signalOneMonthImpactCad === 'number') {
    lines.push(`Current modeled one-month impact is **${formatCad(signalOneMonthImpactCad)}**.`)
  }
  if (topExposureLabel) {
    lines.push(`Largest live exposure in context: **${topExposureLabel}**.`)
  }
  if (typeof warningCount === 'number') {
    lines.push(`Portfolio monitor currently flags **${warningCount} warning${warningCount === 1 ? '' : 's'}**.`)
  }
  lines.push(
    currentSelections.length > 0
      ? `You currently have **${currentSelections.length} candidate${currentSelections.length === 1 ? '' : 's'}** in the scenario.`
      : 'No candidates are selected yet in the current scenario.',
  )

  return lines.join('\n\n')
}

function buildFollowUps(
  message: string,
  proposal: AskPrismPlanProposal | null,
  currentSelections: ReadonlyArray<PlanSelection>,
): ReadonlyArray<string> {
  const intent = classifyIntent(message)
  const prompts: string[] = []

  if (proposal) {
    const addAction = proposal.actions.find((action) => action.type === 'add_candidate')
    const removeAction = proposal.actions.find((action) => action.type === 'remove_candidate')
    const allocationAction = proposal.actions.find((action) => action.type === 'set_allocation')

    if (addAction) {
      prompts.push(`Compare ${addAction.ticker} against the next-best alternative candidate.`)
      prompts.push(`What downside reduction do I lose if I skip ${addAction.ticker}?`)
    }
    if (removeAction) {
      prompts.push(`What happens if I keep ${removeAction.ticker} instead of removing it?`)
    }
    if (allocationAction) {
      prompts.push(`Show a sensitivity range around ${allocationAction.ticker} allocation.`)
    }
  }

  if (intent.wantsDiversification) {
    prompts.push('Which candidate most improves diversification per 1% allocation?')
  }
  if (intent.wantsRiskReduction) {
    prompts.push('Which candidate gives the strongest downside hedge per unit of turnover?')
  }
  if (intent.wantsAlternative) {
    prompts.push('Show me another replacement set with lower tax impact.')
  }

  if (currentSelections.length === 0) {
    prompts.push('Build a low-turnover starter mitigation basket from the top-ranked candidates.')
  } else {
    prompts.push('Summarize the biggest risk gap still uncovered by my current Playbook.')
  }

  prompts.push(
    'What should I review in Signals before applying this update?',
    'Which holdings benefit most from this adjustment?',
  )

  return dedupeStrings(prompts, 4)
}

export function parsePlanCopilotRequest(input: unknown): ParseResult {
  if (!isRecord(input)) {
    return { ok: false, error: 'Invalid request body' }
  }

  const message = asString(input.message)?.trim()
  if (!message) {
    return { ok: false, error: 'message is required' }
  }
  if (message.length > 5000) {
    return { ok: false, error: 'message is too long' }
  }

  const signalId = asString(input.signalId)?.trim() || undefined
  const sessionScope = asString(input.sessionScope)?.trim() as AskPrismSessionScope | undefined
  let entryContext: AskPrismEntryContext | undefined
  if (isRecord(input.entryContext)) {
    const entryType = parseEntryType(input.entryContext.entryType)
    if (entryType) {
      entryContext = {
        entryType,
        signalId: asString(input.entryContext.signalId) ?? undefined,
        nodeId: asString(input.entryContext.nodeId) ?? undefined,
        nodeLabel: asString(input.entryContext.nodeLabel) ?? undefined,
        autoPrompt: asString(input.entryContext.autoPrompt) ?? undefined,
      }
    }
  }

  return {
    ok: true,
    data: {
      signalId,
      sessionScope,
      entryContext,
      message,
      currentSelections: sanitizeSelections(input.currentSelections),
      candidateUniverse: sanitizeCandidateUniverse(input.candidateUniverse),
      history: sanitizeHistory(input.history),
    },
  }
}

export function buildPlanCopilotProposalResponse(
  options: BuildPlanCopilotResponseOptions,
): AskPrismCopilotProposalResponse {
  const proposal = buildProposal(options.message, options.currentSelections, options.candidateUniverse)
  const assistantText = options.assistantText?.trim()
  const normalizedAssistantText =
    assistantText && !assistantText.startsWith('Error:')
      ? assistantText
      : buildFallbackAssistantText(options)

  return {
    assistantText: normalizedAssistantText,
    proposal,
    followUps: buildFollowUps(options.message, proposal, options.currentSelections),
  }
}
