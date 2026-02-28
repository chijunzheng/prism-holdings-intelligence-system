import type {
  AskPrismEntryContext,
  AskPrismPage,
  ExposureMap,
  PlanSelection,
} from '@prism/shared'

interface RankedNavigationChip {
  readonly label: string
  readonly to: string
  readonly score: number
}

export interface AskPrismNavigationChip {
  readonly label: string
  readonly to: string
}

export interface AskPrismWelcomeContextCard {
  readonly title: string
  readonly badges: ReadonlyArray<{ readonly label: string; readonly warning?: boolean }>
}

interface BuildWelcomeContextCardOptions {
  readonly page: AskPrismPage
  readonly signalId?: string
  readonly entryContext?: AskPrismEntryContext | null
  readonly exposureMap?: ExposureMap | null
  readonly planSelections?: ReadonlyArray<PlanSelection>
  readonly holdingTicker?: string
}

function hasAny(haystack: string, keywords: ReadonlyArray<string>): boolean {
  return keywords.some((keyword) => haystack.includes(keyword))
}

function dedupeStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const value of values) {
    const normalized = value.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(value.trim())
  }
  return deduped
}

function currentRouteForPage(page: AskPrismPage, signalId?: string): string {
  if (page === 'signals_overview') return '/signals'
  if (page === 'signal' && signalId) return `/signals/${encodeURIComponent(signalId)}`
  if (page === 'plan' && signalId) return `/signals/${encodeURIComponent(signalId)}/plan`
  return '/portfolio'
}

function fallbackNavigationChips(page: AskPrismPage, signalId?: string): ReadonlyArray<AskPrismNavigationChip> {
  if (page === 'plan' && signalId) {
    return [
      { label: 'Drill Into Signal Path', to: `/signals/${encodeURIComponent(signalId)}` },
      { label: 'Inspect Active Signals', to: '/signals' },
      { label: 'Review Portfolio Exposure', to: '/portfolio' },
    ]
  }
  if (page === 'signal' && signalId) {
    return [
      { label: 'Build Mitigation Playbook', to: `/signals/${encodeURIComponent(signalId)}/plan` },
      { label: 'Inspect Active Signals', to: '/signals' },
      { label: 'Review Portfolio Exposure', to: '/portfolio' },
    ]
  }
  if (page === 'signals_overview') {
    return [
      { label: 'Review Portfolio Exposure', to: '/portfolio' },
    ]
  }
  return [{ label: 'Inspect Active Signals', to: '/signals' }]
}

export function buildNavigationChips(
  page: AskPrismPage,
  signalId: string | undefined,
  messageContext: string,
): ReadonlyArray<AskPrismNavigationChip> {
  const context = messageContext.toLowerCase()
  const currentRoute = currentRouteForPage(page, signalId)
  const chips = new Map<string, RankedNavigationChip>()

  const add = (label: string, to: string, score: number) => {
    const existing = chips.get(to)
    if (!existing || score > existing.score) {
      chips.set(to, { label, to, score })
    }
  }

  if (
    hasAny(context, [
      'overlap',
      'exposure',
      'holding',
      'divers',
      'concentration',
      'allocation',
      'sector',
      'portfolio',
    ])
  ) {
    add('Review Portfolio Exposure', '/portfolio', 8)
  }

  if (
    hasAny(context, [
      'signal',
      'regime',
      'macro',
      'event',
      'impact',
      'cause',
      'causal',
      'monitor',
      'watch',
      'news',
    ])
  ) {
    add('Inspect Active Signals', '/signals', 8)
  }

  if (
    signalId &&
    hasAny(context, [
      'plan',
      'rebalance',
      'mitigat',
      'hedge',
      'offset',
      'reduce risk',
      'what should i do',
      'action',
      'trade-off',
      'tradeoff',
      'candidate',
      'alternative',
      'better option',
    ])
  ) {
    add('Build Mitigation Playbook', `/signals/${encodeURIComponent(signalId)}/plan`, 10)
  }

  if (
    signalId &&
    hasAny(context, [
      'node',
      'mechanism',
      'detail',
      'drill',
      'chain',
      'why',
      'path',
      'confidence',
      'driver',
      'transmission',
    ])
  ) {
    add('Drill Into Signal Path', `/signals/${encodeURIComponent(signalId)}`, 9)
  }

  if (chips.size === 0) {
    fallbackNavigationChips(page, signalId).forEach((chip, index) => {
      add(chip.label, chip.to, 6 - index)
    })
  }

  const filtered = [...chips.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ label, to }) => ({ label, to }))
    .filter((chip) => chip.to !== currentRoute)
    .slice(0, 3)

  if (filtered.length > 0) {
    return filtered
  }

  return fallbackNavigationChips(page, signalId)
    .filter((chip) => chip.to !== currentRoute)
    .slice(0, 3)
}

export function buildFollowUpQueries(
  page: AskPrismPage,
  messageContext: string,
  holdingTicker?: string,
): ReadonlyArray<string> {
  const context = messageContext.toLowerCase()
  const prompts: string[] = []

  if (
    hasAny(context, [
      'overlap',
      'exposure',
      'concentration',
      'diversification',
      'diversified',
      'sector',
      'allocation',
      'portfolio',
    ])
  ) {
    prompts.push(
      'What sector am I most exposed to?',
      'Which overlap is driving the most concentration risk?',
      'How can I reduce concentration without over-trading?',
    )
  }

  if (
    hasAny(context, [
      'signal',
      'regime',
      'macro',
      'event',
      'scenario',
      'monitor',
      'driver',
      'cause',
      'news',
    ])
  ) {
    prompts.push(
      'Which active signal has the largest downside impact?',
      'What changed most in the signal stack this week?',
      'What should I monitor first if this regime worsens?',
    )
  }

  if (
    hasAny(context, [
      'plan',
      'mitigat',
      'hedge',
      'rebalance',
      'trade-off',
      'tradeoff',
      'candidate',
      'alternative',
      'better option',
      'action',
      'do next',
    ])
  ) {
    prompts.push(
      'Which mitigation candidate gives the best risk reduction per trade?',
      'What are the downside trade-offs of this mitigation plan?',
      'Show me an alternative with lower concentration risk',
    )
  }

  if (prompts.length === 0) {
    if (page === 'signals_overview') {
      prompts.push(
        'Which signal deserves immediate attention?',
        'Where is my biggest regime sensitivity right now?',
        'What should I watch in the next week?',
      )
    } else if (page === 'signal') {
      prompts.push(
        'What could invalidate this signal?',
        'What is the strongest counter-signal?',
        'How does this signal transmit into my holdings?',
      )
    } else if (page === 'plan') {
      prompts.push(
        'Which candidate improves diversification the most?',
        'What risks am I introducing with this plan?',
        'What am I missing in this mitigation setup?',
      )
    } else {
      prompts.push(
        'What is my biggest portfolio risk right now?',
        'Where are my largest overlaps?',
        'How diversified is my portfolio across sectors?',
      )
    }
  }

  if (holdingTicker) {
    prompts.unshift(`How does ${holdingTicker} affect my diversification?`)
  }

  return dedupeStrings(prompts).slice(0, 3)
}

export function getAskPrismComposerPlaceholder(
  page: AskPrismPage,
  entryContext?: AskPrismEntryContext | null,
): string {
  if (entryContext?.entryType === 'graph_node') {
    return 'Ask how this node impacts your portfolio...'
  }
  if (entryContext?.entryType === 'signals_canvas') {
    return 'Ask about the full signals canvas and regime links...'
  }
  if (page === 'signals_overview') {
    return 'Ask about active signals and regime risk...'
  }
  if (page === 'signal') {
    return "Ask about this signal's path, confidence, or risks..."
  }
  if (page === 'plan') {
    return 'Ask about trade-offs, alternatives, or mitigation...'
  }
  return 'Ask about your holdings, overlaps, or concentration...'
}

export function getAskPrismWelcomeSubtitle(
  page: AskPrismPage,
  entryContext?: AskPrismEntryContext | null,
): string {
  if (entryContext?.entryType === 'graph_node') {
    return 'Focused on this node within your signal transmission graph'
  }
  if (entryContext?.entryType === 'signals_canvas') {
    return 'Discuss cross-signal interactions across the full canvas'
  }
  if (page === 'signals_overview') {
    return 'Ask about active signal shifts and downstream portfolio impact'
  }
  if (page === 'signal') {
    return 'Ask about this signal, confidence, and transmission path'
  }
  if (page === 'plan') {
    return 'Ask about candidate trade-offs, risk reduction, and alternatives'
  }
  return 'Ask about your portfolio, exposure, or market conditions'
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function buildWelcomeContextCard({
  page,
  signalId,
  entryContext,
  exposureMap,
  planSelections,
  holdingTicker,
}: BuildWelcomeContextCardOptions): AskPrismWelcomeContextCard {
  if (entryContext?.entryType === 'graph_node') {
    return {
      title: 'Focused Node',
      badges: [
        { label: entryContext.nodeLabel ?? 'Selected node' },
        ...(signalId ? [{ label: `Signal ${signalId}` }] : []),
        { label: 'Node-level impact context loaded' },
      ],
    }
  }

  if (entryContext?.entryType === 'signals_canvas') {
    return {
      title: 'Full Signals Canvas',
      badges: [
        { label: 'Cross-signal regime view' },
        { label: 'Transmission paths across holdings' },
      ],
    }
  }

  if (page === 'plan') {
    const selectionCount = planSelections?.length ?? 0
    const totalAllocation =
      planSelections?.reduce((sum, selection) => sum + selection.allocationPct, 0) ?? 0
    return {
      title: 'Mitigation Plan Context',
      badges: [
        ...(signalId ? [{ label: `Signal ${signalId}` }] : []),
        {
          label:
            selectionCount > 0
              ? `${pluralize(selectionCount, 'candidate', 'candidates')} selected`
              : 'No candidates selected yet',
        },
        {
          label:
            selectionCount > 0
              ? `${totalAllocation.toFixed(1)}% proposed allocation`
              : 'Select candidates to evaluate trade-offs',
        },
      ],
    }
  }

  if (page === 'signal') {
    return {
      title: 'Signal Detail Context',
      badges: [
        { label: signalId ? `Signal ${signalId}` : 'Focused signal' },
        { label: 'Transmission path and confidence view' },
      ],
    }
  }

  if (page === 'signals_overview') {
    return {
      title: 'Signals Overview Context',
      badges: [
        { label: 'Live signal workspace' },
        {
          label: exposureMap
            ? `${pluralize(exposureMap.warnings.length, 'warning', 'warnings')} in portfolio monitor`
            : 'Portfolio monitor context loading',
          warning: Boolean(exposureMap && exposureMap.warnings.length > 0),
        },
        { label: 'Track regime shifts across exposures' },
      ],
    }
  }

  const topExposures = exposureMap
    ? [...exposureMap.exposures].sort((a, b) => b.percentage - a.percentage).slice(0, 2)
    : []

  return {
    title: 'Portfolio Context',
    badges: [
      ...topExposures.map((exposure) => ({
        label: `${exposure.category}: ${exposure.percentage.toFixed(1)}%`,
      })),
      ...(exposureMap
        ? [
            {
              label: pluralize(exposureMap.warnings.length, 'warning', 'warnings'),
              warning: exposureMap.warnings.length > 0,
            },
            { label: pluralize(exposureMap.overlaps.length, 'overlap', 'overlaps') },
          ]
        : [{ label: 'Exposure snapshot loading' }]),
      ...(holdingTicker ? [{ label: `Focus: ${holdingTicker}` }] : []),
    ],
  }
}
