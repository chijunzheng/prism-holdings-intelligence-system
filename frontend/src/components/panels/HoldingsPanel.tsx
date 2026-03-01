// HoldingsPanel — Wealthsimple-style card groups showing portfolio holdings.
// Each account is a rounded card; holdings are rows within.
// Includes "Planned Changes" section from saved recommendation candidates.

import { useState } from 'react'
import type { Candidate, Portfolio } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'

interface HoldingsPanelProps {
  readonly portfolio: Portfolio | null | undefined
  readonly isLoading: boolean
  readonly onHoldingClick?: (ticker: string) => void
  readonly candidates?: readonly Candidate[]
  readonly onCandidateAction?: (id: string, action: 'explore' | 'dismiss') => void
  readonly onPreviewPlan?: () => void
}

const ACCOUNT_LABELS: Record<string, string> = {
  TFSA: 'TFSA',
  RRSP: 'RRSP',
  FHSA: 'FHSA',
  LIRA: 'LIRA',
  NON_REGISTERED: 'Non-Registered',
}

function SkeletonCards() {
  return (
    <div className="holdings-panel__skeleton">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="holdings-panel__skeleton-card">
          <div className="holdings-panel__skeleton-label" />
          {Array.from({ length: 2 }, (_, j) => (
            <div key={j} className="holdings-panel__skeleton-row">
              <div className="holdings-panel__skeleton-circle" />
              <div className="holdings-panel__skeleton-lines">
                <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--name" />
                <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--sub" />
              </div>
              <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--value" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const ACTION_VERB_MAP: Record<Candidate['action'], string> = {
  reduce: 'Reduce',
  increase: 'Increase',
  hold: 'Hold',
  add_new: 'Add',
  remove: 'Remove',
}

function PlannedChangesSection({
  candidates,
  onCandidateAction,
  onPreviewPlan,
}: {
  readonly candidates: readonly Candidate[]
  readonly onCandidateAction?: (id: string, action: 'explore' | 'dismiss') => void
  readonly onPreviewPlan?: () => void
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set())

  if (candidates.length === 0) {
    return (
      <div className="holdings-panel__planned">
        <h4 className="holdings-panel__planned-title">Planned Changes</h4>
        <p className="holdings-panel__planned-empty">
          Save plans from recommendations to track them here
        </p>
      </div>
    )
  }

  // Group by sourceLabel
  const groups = new Map<string, readonly Candidate[]>()
  for (const c of candidates) {
    const existing = groups.get(c.sourceLabel) ?? []
    groups.set(c.sourceLabel, [...existing, c])
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="holdings-panel__planned">
      <h4 className="holdings-panel__planned-title">
        Planned Changes ({candidates.length})
      </h4>

      {[...groups.entries()].map(([label, items]) => {
        const isCollapsed = collapsedGroups.has(label)
        return (
          <div key={label} className="holdings-panel__planned-group">
            <button
              type="button"
              className="holdings-panel__planned-group-header"
              onClick={() => toggleGroup(label)}
            >
              <span className={`holdings-panel__planned-chevron ${isCollapsed ? '' : 'holdings-panel__planned-chevron--open'}`}>
                ▸
              </span>
              <span className="holdings-panel__planned-group-label">{label}</span>
              <span className="holdings-panel__planned-group-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <ul className="holdings-panel__planned-list">
                {items.map((c) => (
                  <li key={c.id} className="holdings-panel__planned-item">
                    <TickerIcon ticker={c.ticker} size={24} />
                    <span className={`holdings-panel__planned-verb holdings-panel__planned-verb--${c.action}`}>
                      {ACTION_VERB_MAP[c.action]}
                    </span>
                    <span className="holdings-panel__planned-ticker">{c.ticker}</span>
                    {c.suggestedChangeCad !== undefined && (
                      <span className="holdings-panel__planned-amount">
                        {c.suggestedChangeCad >= 0 ? '+' : ''}${Math.abs(c.suggestedChangeCad).toLocaleString()}
                      </span>
                    )}
                    <button
                      type="button"
                      className="holdings-panel__planned-dismiss"
                      onClick={() => onCandidateAction?.(c.id, 'dismiss')}
                      aria-label={`Dismiss ${c.ticker}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {onPreviewPlan && (
        <button
          type="button"
          className="holdings-panel__preview-btn"
          onClick={onPreviewPlan}
        >
          Preview Plan Impact
        </button>
      )}
    </div>
  )
}

export function HoldingsPanel({ portfolio, isLoading, onHoldingClick, candidates, onCandidateAction, onPreviewPlan }: HoldingsPanelProps) {
  if (isLoading) {
    return (
      <div className="holdings-panel">
        <h3 className="holdings-panel__title">Holdings</h3>
        <SkeletonCards />
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="holdings-panel">
        <h3 className="holdings-panel__title">Holdings</h3>
        <div className="holdings-panel__empty">
          Connect your portfolio to get started
        </div>
      </div>
    )
  }

  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = allHoldings.reduce((sum, h) => sum + h.valueCad, 0)

  return (
    <div className="holdings-panel">
      <div className="holdings-panel__header">
        <h3 className="holdings-panel__title">Holdings</h3>
        <span className="holdings-panel__total">${totalValue.toLocaleString()}</span>
      </div>

      <div className="holdings-panel__groups">
        {portfolio.accounts.map((account) => {
          const label = ACCOUNT_LABELS[account.type] ?? account.type
          const isFhsa = account.type === 'FHSA'

          return (
            <div key={account.id} className="holdings-panel__card">
              <div className="holdings-panel__card-header">
                <span className="holdings-panel__account-label">{label}</span>
                {isFhsa && (
                  <span className="holdings-panel__account-badge">Short horizon</span>
                )}
              </div>

              <ul className="holdings-panel__list">
                {account.holdings.map((h) => {
                  const pct = ((h.valueCad / totalValue) * 100).toFixed(0)
                  return (
                    <li
                      key={`${account.id}-${h.ticker}`}
                      className="holdings-panel__item"
                      onClick={() => onHoldingClick?.(h.ticker)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onHoldingClick?.(h.ticker)
                      }}
                    >
                      <TickerIcon ticker={h.ticker} size={32} />
                      <span className="holdings-panel__info">
                        <span className="holdings-panel__ticker">{h.ticker}</span>
                        <span className="holdings-panel__name">{h.name}</span>
                      </span>
                      <span className="holdings-panel__values">
                        <span className="holdings-panel__value">${h.valueCad.toLocaleString()}</span>
                        <span className="holdings-panel__pct">{pct}%</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {candidates && (
        <PlannedChangesSection
          candidates={candidates}
          onCandidateAction={onCandidateAction}
          onPreviewPlan={onPreviewPlan}
        />
      )}
    </div>
  )
}
